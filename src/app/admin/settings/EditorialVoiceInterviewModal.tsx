'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  RotateCcw,
  BookOpen,
  Users,
  MessageSquare,
  Award,
  Layers,
  Loader2,
  FileText
} from 'lucide-react';

interface EditorialVoiceInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (data: {
    site_activity_context: string;
    site_target_persona: string;
    site_tone_of_voice: string;
    site_brand_tone: string;
    site_blog_topics: string;
  }) => void;
  initialValues?: {
    site_activity_context?: string;
    site_target_persona?: string;
    site_tone_of_voice?: string;
    site_brand_tone?: string;
    site_blog_topics?: string;
  };
}

interface StepConfig {
  id: string;
  title: string;
  fieldKey: 'site_activity_context' | 'site_target_persona' | 'site_tone_of_voice' | 'site_brand_tone' | 'site_blog_topics';
  icon: React.ElementType;
  initialQuestion: string;
}

const STEPS: StepConfig[] = [
  {
    id: 'activity',
    title: 'Activité & Spécialités',
    fieldKey: 'site_activity_context',
    icon: BookOpen,
    initialQuestion: 'Pouvez-vous présenter votre entreprise, votre métier, vos spécialités et vos offres principales ?',
  },
  {
    id: 'target',
    title: 'Public Cible & Persona',
    fieldKey: 'site_target_persona',
    icon: Users,
    initialQuestion: 'À qui s’adresse vos prestations ? Quel est le profil idéal de vos clients (âge, besoins, désirs, problématiques) ?',
  },
  {
    id: 'tone',
    title: 'Ton de Voix & Posture',
    fieldKey: 'site_tone_of_voice',
    icon: MessageSquare,
    initialQuestion: 'Quel ton souhaitez-vous adopter avec vos visiteurs (vouvoiement/tutoiement, chaleureux, rassurant, expert, dynamique) ?',
  },
  {
    id: 'brand',
    title: 'Ton de Marque & Valeurs',
    fieldKey: 'site_brand_tone',
    icon: Award,
    initialQuestion: 'Quelles sont les valeurs clés de votre marque, vos promesses phares et les mots clés importants à privilégier ?',
  },
  {
    id: 'topics',
    title: 'Piliers & Thématiques du Blog',
    fieldKey: 'site_blog_topics',
    icon: Layers,
    initialQuestion: 'Quelles sont les 4 à 6 grandes thématiques sur lesquelles vous aimeriez écrire régulièrement des articles de blog ?',
  },
];

export default function EditorialVoiceInterviewModal({
  isOpen,
  onClose,
  onApply,
  initialValues,
}: EditorialVoiceInterviewModalProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);

  // States per step
  const [stepHistories, setStepHistories] = useState<Record<number, string[]>>({ 0: [], 1: [], 2: [], 3: [], 4: [] });
  const [stepFollowUpCounts, setStepFollowUpCounts] = useState<Record<number, number>>({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 });
  const [currentQuestions, setCurrentQuestions] = useState<Record<number, string>>({
    0: STEPS[0].initialQuestion,
    1: STEPS[1].initialQuestion,
    2: STEPS[2].initialQuestion,
    3: STEPS[3].initialQuestion,
    4: STEPS[4].initialQuestion,
  });
  const [stepSummaries, setStepSummaries] = useState<Record<number, string>>({});

  // Loading & evaluation states
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalFeedback, setEvalFeedback] = useState<{ status: 'sufficient' | 'incomplete'; text: string } | null>(null);

  // Synthesis state
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesizedResult, setSynthesizedResult] = useState<{
    site_activity_context: string;
    site_target_persona: string;
    site_tone_of_voice: string;
    site_brand_tone: string;
    site_blog_topics: string;
  } | null>(null);

  const recognitionRef = useRef<any>(null);

  // Initialize Web Speech API
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'fr-FR';

        recognition.onresult = (event: any) => {
          let currentInterim = '';
          let finalConcat = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalConcat += event.results[i][0].transcript + ' ';
            } else {
              currentInterim += event.results[i][0].transcript;
            }
          }

          if (finalConcat) {
            setTranscript((prev) => (prev ? prev + ' ' + finalConcat.trim() : finalConcat.trim()));
          }
          setInterimTranscript(currentInterim);
        };

        recognition.onerror = (event: any) => {
          console.error('[SpeechRecognition] Erreur :', event.error);
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
      } else {
        setSpeechSupported(false);
      }
    }
  }, []);

  // Stop recording when step changes
  useEffect(() => {
    stopRecording();
    setTranscript('');
    setInterimTranscript('');
    setEvalFeedback(null);
  }, [currentStepIndex]);

  const startRecording = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
      setIsRecording(true);
    } catch (e) {
      console.warn('SpeechRecognition déjà actif', e);
      setIsRecording(true);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Evaluate current answer with Claude
  const handleValidateAnswer = async () => {
    stopRecording();
    const answerText = transcript.trim();
    if (!answerText) return;

    setIsEvaluating(true);
    setEvalFeedback(null);

    const currentConfig = STEPS[currentStepIndex];
    const currentQuestion = currentQuestions[currentStepIndex];
    const history = stepHistories[currentStepIndex] || [];
    const followUpCount = stepFollowUpCounts[currentStepIndex] || 0;

    try {
      const res = await fetch('/api/admin/editorial-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'evaluate_step',
          stepIndex: currentStepIndex,
          topicTitle: currentConfig.title,
          question: currentQuestion,
          transcript: answerText,
          currentFollowUpCount: followUpCount,
          stepHistory: history,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur d’évaluation');

      if (data.status === 'incomplete' && data.followUpQuestion) {
        // Claude asks a follow up question!
        setEvalFeedback({
          status: 'incomplete',
          text: data.feedback || 'Claude souhaite des précisions complémentaires.',
        });
        setCurrentQuestions((prev) => ({ ...prev, [currentStepIndex]: data.followUpQuestion }));
        setStepHistories((prev) => ({
          ...prev,
          [currentStepIndex]: [...(prev[currentStepIndex] || []), `Q: ${currentQuestion}`, `R: ${answerText}`],
        }));
        setStepFollowUpCounts((prev) => ({ ...prev, [currentStepIndex]: followUpCount + 1 }));
        setTranscript('');
      } else {
        // Claude considers response sufficient!
        setEvalFeedback({
          status: 'sufficient',
          text: data.feedback || 'Réponse enregistrée avec succès !',
        });
        const finalAnswerSummary = data.summary || answerText;
        setStepSummaries((prev) => ({ ...prev, [currentStepIndex]: finalAnswerSummary }));

        // Move to next step or start synthesis after short delay
        setTimeout(() => {
          if (currentStepIndex < STEPS.length - 1) {
            setCurrentStepIndex((prev) => prev + 1);
          } else {
            // All 5 steps complete -> Trigger synthesis
            handleTriggerSynthesis({
              ...stepSummaries,
              [currentStepIndex]: finalAnswerSummary,
            });
          }
        }, 1200);
      }
    } catch (err: any) {
      console.error('Erreur lors de la validation :', err);
      setEvalFeedback({
        status: 'incomplete',
        text: 'Erreur d’analyse par Claude. Vous pouvez réessayer ou modifier le texte.',
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  // Trigger full synthesis across all 5 steps
  const handleTriggerSynthesis = async (finalSummaries: Record<number, string>) => {
    setCurrentStepIndex(STEPS.length); // Step 5 = Synthesis view
    setIsSynthesizing(true);

    const formattedPayload = STEPS.map((s, idx) => ({
      stepIndex: idx,
      topic: s.title,
      fieldKey: s.fieldKey,
      history: stepHistories[idx] || [],
      summary: finalSummaries[idx] || initialValues?.[s.fieldKey] || '',
    }));

    try {
      const res = await fetch('/api/admin/editorial-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'synthesize_all',
          answers: formattedPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la synthèse');

      setSynthesizedResult({
        site_activity_context: data.site_activity_context || '',
        site_target_persona: data.site_target_persona || '',
        site_tone_of_voice: data.site_tone_of_voice || '',
        site_brand_tone: data.site_brand_tone || '',
        site_blog_topics: data.site_blog_topics || '',
      });
    } catch (err: any) {
      console.error('Erreur de synthèse :', err);
    } finally {
      setIsSynthesizing(false);
    }
  };

  if (!isOpen) return null;

  const currentStep = STEPS[currentStepIndex];
  const StepIcon = currentStep?.icon || Sparkles;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-sm animate-fadein">
      <div className="relative w-full max-w-2xl bg-white border border-stone-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-950 text-white flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md">
              <Mic size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-base flex items-center gap-2">
                Interview Vocale Claude
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-normal border border-amber-500/30">
                  IA Interactive
                </span>
              </h3>
              <p className="text-stone-400 text-xs">
                {currentStepIndex < STEPS.length
                  ? `Question ${currentStepIndex + 1} sur ${STEPS.length} — ${currentStep.title}`
                  : 'Synthèse finale de la ligne éditoriale'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-stone-100 h-1.5">
          <div
            className="bg-gradient-to-r from-amber-500 to-orange-500 h-1.5 transition-all duration-500"
            style={{
              width: `${Math.min(100, ((currentStepIndex + (currentStepIndex === STEPS.length ? 1 : 0.5)) / STEPS.length) * 100)}%`,
            }}
          />
        </div>

        {/* Main Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {currentStepIndex < STEPS.length ? (
            <>
              {/* Step Title & Question */}
              <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-stone-900 font-medium text-sm">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <StepIcon size={16} />
                  </div>
                  <span>{currentStep.title}</span>
                </div>
                <h4 className="text-base font-semibold text-stone-900 leading-snug">
                  {currentQuestions[currentStepIndex]}
                </h4>
                {stepHistories[currentStepIndex]?.length > 0 && (
                  <div className="pt-2 text-xs text-stone-500 border-t border-stone-200/60 space-y-1">
                    <p className="font-medium text-stone-600">Échanges précédents sur ce thème :</p>
                    {stepHistories[currentStepIndex].map((line, idx) => (
                      <p key={idx} className="italic text-stone-600">{line}</p>
                    ))}
                  </div>
                )}
              </div>

              {/* Speech Recognition Recording Area */}
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-4 bg-gradient-to-b from-amber-50/50 to-orange-50/20 border border-amber-200/60 rounded-xl">
                  {/* Glowing Mic Button */}
                  <button
                    type="button"
                    onClick={toggleRecording}
                    className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg cursor-pointer ${
                      isRecording
                        ? 'bg-red-600 text-white ring-4 ring-red-300 animate-pulse scale-105'
                        : 'bg-stone-900 text-white hover:bg-stone-800 hover:scale-105'
                    }`}
                  >
                    {isRecording ? <MicOff size={28} /> : <Mic size={28} />}
                  </button>

                  <p className="mt-3 text-xs font-medium text-stone-700 flex items-center gap-1.5">
                    {isRecording ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        Microphone actif — Parlez à voix haute...
                      </>
                    ) : (
                      'Cliquez sur le micro pour répondre à l’oral'
                    )}
                  </p>

                  {!speechSupported && (
                    <p className="mt-2 text-xs text-amber-700 bg-amber-100 px-3 py-1 rounded-md">
                      ⚠️ Reconnaissance vocale non gérée par ce navigateur. Vous pouvez saisir votre réponse directement dans la zone de texte ci-dessous.
                    </p>
                  )}
                </div>

                {/* Transcript Input & Correction Box */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-stone-700 flex justify-between">
                    <span>Réponse retranscrite (modifiable) :</span>
                    {transcript && (
                      <button
                        type="button"
                        onClick={() => setTranscript('')}
                        className="text-stone-500 hover:text-stone-800 text-[11px] underline flex items-center gap-1"
                      >
                        <RotateCcw size={10} /> Effacer
                      </button>
                    )}
                  </label>
                  <textarea
                    rows={4}
                    value={transcript + (interimTranscript ? ` (${interimTranscript}...)` : '')}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Votre réponse orale apparaîtra ici au fur et à mesure que vous parlez, ou écrivez-la directement..."
                    className="w-full rounded-xl border border-stone-300 bg-white p-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-colors resize-y leading-relaxed"
                  />
                </div>

                {/* Claude Feedback Alert */}
                {evalFeedback && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                      evalFeedback.status === 'sufficient'
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    {evalFeedback.status === 'sufficient' ? (
                      <CheckCircle2 size={16} className="text-green-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">{evalFeedback.text}</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Synthesis Final View */
            <div className="space-y-5">
              <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-stone-900">
                    Ligne éditoriale générée avec succès !
                  </h4>
                  <p className="text-xs text-stone-600">
                    Claude a synthétisé vos réponses vocales en 5 blocs optimisés. Cliquez sur "Appliquer" pour pré-remplir les champs.
                  </p>
                </div>
              </div>

              {isSynthesizing ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <Loader2 size={32} className="text-amber-600 animate-spin" />
                  <p className="text-sm font-medium text-stone-700">
                    Rédaction et structuration de la ligne éditoriale par Claude…
                  </p>
                </div>
              ) : synthesizedResult ? (
                <div className="space-y-4">
                  {[
                    { key: 'site_activity_context', label: '1. Activité & Contexte général' },
                    { key: 'site_target_persona', label: '2. Public Cible & Persona' },
                    { key: 'site_tone_of_voice', label: '3. Ton de voix & Style' },
                    { key: 'site_brand_tone', label: '4. Ton de marque & Promesses' },
                    { key: 'site_blog_topics', label: '5. Piliers thématiques du Blog' },
                  ].map((field) => (
                    <div key={field.key} className="border border-stone-200 rounded-xl p-3.5 bg-stone-50/50 space-y-1.5">
                      <h5 className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                        <FileText size={14} className="text-amber-600" />
                        {field.label}
                      </h5>
                      <p className="text-xs text-stone-600 whitespace-pre-line leading-relaxed pl-5">
                        {(synthesizedResult as any)[field.key]}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
          {currentStepIndex < STEPS.length ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (currentStepIndex > 0) setCurrentStepIndex((prev) => prev - 1);
                }}
                disabled={currentStepIndex === 0 || isEvaluating}
                className="px-3.5 py-2 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-200/60 disabled:opacity-40 transition-colors"
              >
                Précédent
              </button>

              <button
                type="button"
                onClick={handleValidateAnswer}
                disabled={!transcript.trim() || isEvaluating}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-md disabled:opacity-50 transition-all cursor-pointer"
              >
                {isEvaluating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Analyse par Claude...
                  </>
                ) : (
                  <>
                    Valider la réponse vocale
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="flex items-center justify-end gap-3 w-full">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-200/60 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isSynthesizing || !synthesizedResult}
                onClick={() => {
                  if (synthesizedResult) {
                    onApply(synthesizedResult);
                    onClose();
                  }
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-xs font-semibold shadow-lg disabled:opacity-50 transition-all cursor-pointer"
              >
                <Sparkles size={16} />
                Appliquer à la ligne éditoriale
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
