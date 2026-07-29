"use client";

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Mail } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { trackEvent } from '../../utils/analytics';
import EmailGate from './EmailGate';
import ResultScreen from './ResultScreen';

type Category = { id: string; label: string; description: string };
type Question = { id: number; categoryId: string; text: string };
type Profile = {
  id: string; tag: string; zone: string; minScore: number; maxScore: number;
  title: string; tagline: string; body: string[]; ctaType: 'soft' | 'strong'; ctaLabel: string; ctaHref: string;
};
type QuizData = {
  meta: { title: string; subtitle: string; intro: string; estimatedTime: string; startCta: string; maxScore: number; scale: { value: number; label: string }[] };
  categories: Category[];
  questions: Question[];
  profiles: Profile[];
  share: { textTemplate: string };
};

type Step = 'intro' | 'quiz' | 'gate' | 'sending' | 'sent' | 'result';

export type { QuizData };

export default function DecodeurQuizClient({
  data,
  sharedResult,
}: {
  data: QuizData;
  /** Permet de rouvrir directement un résultat déjà obtenu (lien envoyé par email). */
  sharedResult?: { score: number; profileTag: string };
}) {
  const sharedProfile = useMemo(
    () => (sharedResult ? data.profiles.find(p => p.tag === sharedResult.profileTag) : undefined),
    [data.profiles, sharedResult]
  );

  const [step, setStep] = useState<Step>(sharedResult && sharedProfile ? 'result' : 'intro');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const total = data.questions.length;
  const currentQuestion = data.questions[index];
  const currentCategory = useMemo(
    () => data.categories.find(c => c.id === currentQuestion?.categoryId),
    [data.categories, currentQuestion]
  );

  const score = useMemo(
    () => Object.values(answers).reduce((sum, v) => sum + v, 0),
    [answers]
  );

  const profile = useMemo(
    () => data.profiles.find(p => score >= p.minScore && score <= p.maxScore) || data.profiles[0],
    [data.profiles, score]
  );

  // Vue par question : permet de mesurer le taux d'abandon question par
  // question dans l'outil d'analytics (funnel start → question N → gate).
  useEffect(() => {
    if (step === 'quiz' && currentQuestion) {
      trackEvent('decodeur_question_view', {
        question_number: index + 1,
        total_questions: total,
        category: currentCategory?.label,
      });
    }
  }, [step, index, currentQuestion, total, currentCategory]);

  useEffect(() => {
    if (step === 'gate') {
      trackEvent('decodeur_gate_view', { profile: profile.tag, score });
    }
  }, [step, profile, score]);

  const handleStart = () => {
    trackEvent('decodeur_start');
    setStep('quiz');
  };

  const handleAnswer = (value: number) => {
    const nextAnswers = { ...answers, [currentQuestion.id]: value };
    setAnswers(nextAnswers);

    if (index < total - 1) {
      setIndex(index + 1);
    } else {
      trackEvent('decodeur_complete', { score: Object.values(nextAnswers).reduce((s, v) => s + v, 0) });
      setStep('gate');
    }
  };

  const handleBack = () => {
    if (index > 0) setIndex(index - 1);
  };

  const handleUnlock = async (email: string) => {
    try {
      const quizFields = {
        quiz_profile: profile.tag,
        quiz_score: score,
        quiz_completed_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('subscribers').insert([{ email, ...quizFields }]);
      if (error?.code === '23505') {
        // Email déjà inscrit : on met à jour son tag/score pour qu'il entre
        // quand même dans la séquence email avec son nouveau profil.
        const { error: updateError } = await supabase.from('subscribers').update(quizFields).eq('email', email);
        if (updateError) {
          console.warn('Mise à jour décodeur non enregistrée:', updateError.message);
        }
      } else if (error) {
        console.warn('Inscription décodeur non enregistrée:', error.message);
      }
    } catch (err) {
      console.warn('Inscription décodeur non enregistrée:', err);
    }
    trackEvent('decodeur_email_submitted', { profile: profile.tag });
    setStep('sending');
    setTimeout(() => setStep('sent'), 1800);
  };

  if (step === 'intro') {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 md:py-24 text-center">
        <p className="text-sage font-bold tracking-[0.3em] uppercase text-xs mb-6">{data.meta.estimatedTime} chrono</p>
        <h1 className="font-serif text-4xl md:text-6xl font-bold text-stone-900 mb-6 leading-tight">{data.meta.title}</h1>
        <p className="text-lg text-stone-500 font-light leading-relaxed mb-4">{data.meta.subtitle}</p>
        <p className="text-stone-500 leading-relaxed mb-10 font-light">{data.meta.intro}</p>
        <button
          onClick={handleStart}
          className="bg-sage text-white px-10 py-4 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-stone-deep transition-colors"
        >
          {data.meta.startCta}
        </button>
      </div>
    );
  }

  if (step === 'gate') {
    return <EmailGate score={score} maxScore={data.meta.maxScore} onUnlock={handleUnlock} />;
  }

  if (step === 'sending') {
    return (
      <div className="max-w-md mx-auto px-6 py-24 text-center flex flex-col items-center gap-6">
        <div className="w-10 h-10 rounded-full border-2 border-stone-200 border-t-sage animate-spin" />
        <p className="text-stone-500 font-medium">Envoi de votre profil par email…</p>
      </div>
    );
  }

  if (step === 'sent') {
    return (
      <div className="max-w-md mx-auto px-6 py-24 text-center">
        <div className="w-14 h-14 rounded-full bg-sage/10 flex items-center justify-center mx-auto mb-6">
          <Mail className="w-6 h-6 text-sage" />
        </div>
        <h1 className="font-serif text-3xl font-bold text-stone-900 mb-4">Vérifiez votre boîte mail.</h1>
        <p className="text-stone-500 leading-relaxed font-light mb-2">
          Votre profil complet au Décodeur de Relations vient de partir vers votre adresse email.
        </p>
        <p className="text-stone-500 leading-relaxed font-light mb-8">
          Il peut arriver dans quelques minutes — pensez à vérifier vos spams si vous ne le voyez pas tout de suite.
        </p>
        <a
          href="/blog"
          className="inline-flex items-center gap-2 border-2 border-stone-900 text-stone-900 px-6 py-3 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-stone-900 hover:text-white transition-colors"
        >
          En attendant, lire le blog
        </a>
      </div>
    );
  }

  if (step === 'result') {
    const effectiveProfile = sharedResult && sharedProfile ? sharedProfile : profile;
    const effectiveScore = sharedResult && sharedProfile ? sharedResult.score : score;
    return (
      <ResultScreen
        profile={effectiveProfile}
        score={effectiveScore}
        maxScore={data.meta.maxScore}
        shareTemplate={data.share.textTemplate}
      />
    );
  }

  // step === 'quiz'
  const progress = Math.round((index / total) * 100);
  const selected = answers[currentQuestion.id];

  return (
    <div className="max-w-lg mx-auto px-6 py-12 md:py-16 min-h-[80vh] flex flex-col">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={handleBack}
            disabled={index === 0}
            className="flex items-center gap-1 text-stone-400 hover:text-stone-900 disabled:opacity-0 transition-colors text-xs font-bold uppercase tracking-widest"
          >
            <ChevronLeft className="w-4 h-4" /> Retour
          </button>
          <span className="text-xs font-bold uppercase tracking-widest text-stone-400">{index + 1} / {total}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
          <div className="h-full rounded-full bg-sage transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        {currentCategory && (
          <p className="text-sage text-xs font-bold uppercase tracking-widest mt-4">{currentCategory.label}</p>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <h2 className="font-serif text-2xl md:text-3xl font-bold text-stone-900 leading-snug mb-10">
          {currentQuestion.text}
        </h2>

        <div className="space-y-3">
          {data.meta.scale.map(option => (
            <button
              key={option.value}
              onClick={() => handleAnswer(option.value)}
              className={`w-full text-left px-6 py-4 rounded-2xl border-2 font-medium transition-colors ${
                selected === option.value
                  ? 'border-sage bg-sage/10 text-stone-900'
                  : 'border-stone-200 text-stone-600 hover:border-sage/40 hover:bg-stone-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
