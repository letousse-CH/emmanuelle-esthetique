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
  FileText,
  Check
} from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { runAiJob } from '../../../hooks/useAiJob';
import AiJobProgress from '../../../components/admin/AiJobProgress';

/** Jeton de session exigé par /api/admin/editorial-interview. */
async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

/**
 * Message lisible pour un échec de la route. Sur Netlify, une réponse de l'IA
 * trop lente coupe la fonction : le navigateur reçoit alors un 502/504 avec une
 * page HTML, sans message exploitable.
 */
function describeFailure(status: number, serverMessage?: string): string {
  if (status === 401) return 'Votre session a expiré. Reconnectez-vous, puis réessayez';
  if (status === 502 || status === 503 || status === 504) {
    return "L'IA a mis trop de temps à répondre. Patientez quelques secondes, puis réessayez";
  }
  return serverMessage || `erreur ${status}`;
}

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
    title: 'Activité et spécialités',
    fieldKey: 'site_activity_context',
    icon: BookOpen,
    initialQuestion: 'Pouvez-vous présenter votre entreprise, votre métier, vos spécialités et vos offres principales ?',
  },
  {
    id: 'target',
    title: 'Clientèle visée',
    fieldKey: 'site_target_persona',
    icon: Users,
    initialQuestion: 'À qui s’adressent vos prestations ? Quel est le profil idéal de vos clients (âge, besoins, désirs, problématiques) ?',
  },
  {
    id: 'tone',
    title: 'Ton et posture',
    fieldKey: 'site_tone_of_voice',
    icon: MessageSquare,
    initialQuestion: 'Quel ton souhaitez-vous adopter avec vos visiteurs (vouvoiement/tutoiement, chaleureux, rassurant, expert, dynamique) ?',
  },
  {
    id: 'brand',
    title: 'Valeurs et promesse',
    fieldKey: 'site_brand_tone',
    icon: Award,
    initialQuestion: 'Quelles sont les valeurs clés de votre marque, vos promesses phares et les mots clés importants à privilégier ?',
  },
  {
    id: 'topics',
    title: 'Grands thèmes du blog',
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
  const [micError, setMicError] = useState<string | null>(null);

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
  // Temps écoulé de la synthèse (tâche de fond, souvent plus d'une minute).
  const [synthSeconds, setSynthSeconds] = useState(0);
  useEffect(() => {
    if (!isSynthesizing) return;
    const t0 = Date.now();
    setSynthSeconds(0);
    const timer = setInterval(() => setSynthSeconds(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [isSynthesizing]);
  const [synthesizedResult, setSynthesizedResult] = useState<{
    site_activity_context: string;
    site_target_persona: string;
    site_tone_of_voice: string;
    site_brand_tone: string;
    site_blog_topics: string;
  } | null>(null);

  const [synthError, setSynthError] = useState<string | null>(null);
  const lastSummariesRef = useRef<Record<number, string>>({});

  const recognitionRef = useRef<any>(null);

  // Micro coupé à la fermeture de la fenêtre et au démontage : il restait
  // allumé tant que la page était ouverte.
  useEffect(() => {
    if (!isOpen) {
      try { recognitionRef.current?.stop(); } catch { /* déjà arrêté */ }
      setIsRecording(false);
    }
  }, [isOpen]);
  useEffect(() => () => {
    try { recognitionRef.current?.stop(); } catch { /* déjà arrêté */ }
  }, []);

  const hasProgress = transcript.trim().length > 0 || Object.keys(stepSummaries).length > 0 || synthesizedResult !== null;
  const requestClose = () => {
    if (hasProgress && !isSynthesizing && synthesizedResult === null
      && !confirm("Fermer l'entretien ? Les réponses déjà données seront perdues.")) return;
    onClose();
  };
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

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
          // Le micro s'arrêtait sans rien dire : on explique pourquoi.
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setMicError("Le micro n'est pas autorisé pour ce site. Écrivez votre réponse dans la zone de texte ci-dessous.");
          } else if (event.error === 'audio-capture') {
            setMicError('Aucun micro détecté. Écrivez votre réponse dans la zone de texte ci-dessous.');
          } else if (event.error === 'network') {
            setMicError('La reconnaissance vocale ne répond pas (connexion). Écrivez votre réponse, ou réessayez plus tard.');
          }
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
    setMicError(null);
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
        headers: await authHeaders(),
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

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(describeFailure(res.status, data.error));

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
        text: `Votre réponse n'a pas pu être analysée (${err?.message || 'erreur inconnue'}). Elle est toujours là : réessayez dans un instant.`,
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  // Trigger full synthesis across all 5 steps
  const handleTriggerSynthesis = async (finalSummaries: Record<number, string>) => {
    setCurrentStepIndex(STEPS.length); // Step 5 = Synthesis view
    setIsSynthesizing(true);
    setSynthError(null);
    lastSummariesRef.current = finalSummaries;

    const formattedPayload = STEPS.map((s, idx) => ({
      stepIndex: idx,
      topic: s.title,
      fieldKey: s.fieldKey,
      history: stepHistories[idx] || [],
      summary: finalSummaries[idx] || initialValues?.[s.fieldKey] || '',
    }));

    try {
      // Tâche de fond : la synthèse dépasse souvent les 60 s d'une fonction
      // Netlify synchrone (action « synthesize_all » de la route d'entretien).
      const data = (await runAiJob<Record<string, string>>('editorial-synthesis', {
        answers: formattedPayload,
      })) ?? {};

      setSynthesizedResult({
        site_activity_context: data.site_activity_context || '',
        site_target_persona: data.site_target_persona || '',
        site_tone_of_voice: data.site_tone_of_voice || '',
        site_brand_tone: data.site_brand_tone || '',
        site_blog_topics: data.site_blog_topics || '',
      });
    } catch (err: any) {
      console.error('Erreur de synthèse :', err);
      setSynthError(`La synthèse n'a pas pu être rédigée (${err?.message || 'erreur inconnue'}). Vos réponses sont conservées : relancez-la.`);
    } finally {
      setIsSynthesizing(false);
    }
  };

  if (!isOpen) return null;

  const currentStep = STEPS[currentStepIndex];
  const StepIcon = currentStep?.icon || Sparkles;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-sm animate-fadein">
      <div role="dialog" aria-modal="true" aria-labelledby="editorial-interview-title" className="relative w-full max-w-2xl bg-white border border-stone-200 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-white flex items-center justify-between border-b border-stone-200">
          <div className="flex items-center gap-3">
            <div className="bg-stone-100 w-9 h-9 rounded-xl flex items-center justify-center text-stone-700">
              <Mic size={20} />
            </div>
            <div>
              <h3 id="editorial-interview-title" className="font-semibold text-base text-stone-950">
                Décrire votre activité à l&apos;oral
              </h3>
              <p className="text-stone-600 text-[13px]">
                {currentStepIndex < STEPS.length
                  ? `Question ${currentStepIndex + 1} sur ${STEPS.length} — ${currentStep.title}`
                  : 'Synthèse finale de la ligne éditoriale'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-stone-100 h-1.5">
          <div
            className="bg-accent h-1.5 transition-all duration-500"
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
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-stone-900 font-medium text-sm">
                  <div className="w-7 h-7 rounded-lg bg-stone-200 text-stone-700 flex items-center justify-center shrink-0">
                    <StepIcon size={16} />
                  </div>
                  <span>{currentStep.title}</span>
                </div>
                <h4 className="text-base font-semibold text-stone-900 leading-snug">
                  {currentQuestions[currentStepIndex]}
                </h4>
                {stepHistories[currentStepIndex]?.length > 0 && (
                  <div className="pt-2 text-xs text-stone-600 border-t border-stone-200 space-y-1">
                    <p className="font-medium text-stone-700">Échanges précédents sur ce thème :</p>
                    {stepHistories[currentStepIndex].map((line, idx) => (
                      <p key={idx} className="italic text-stone-700">{line}</p>
                    ))}
                  </div>
                )}
              </div>

              {/* Speech Recognition Recording Area */}
              <div className="space-y-4">
                <div className="bg-stone-50 flex flex-col items-center justify-center py-4 border border-stone-200 rounded-xl">
                  <button
                    type="button"
                    onClick={toggleRecording}
                    disabled={!speechSupported}
                    aria-pressed={isRecording}
                    aria-label={isRecording ? "Arrêter l'enregistrement" : 'Répondre au micro'}
                    className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-default ${
                      isRecording
                        ? 'bg-red-600 text-white ring-4 ring-red-200'
                        : 'bg-stone-900 text-white hover:bg-stone-800'
                    }`}
                  >
                    {isRecording ? <MicOff size={28} /> : <Mic size={28} />}
                  </button>

                  <p className="mt-3 text-[13px] font-medium text-stone-700 flex items-center gap-1.5">
                    {isRecording ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        Micro allumé : parlez normalement, puis cliquez à nouveau pour arrêter.
                      </>
                    ) : (
                      'Cliquez sur le micro pour répondre à l’oral, ou écrivez votre réponse ci-dessous.'
                    )}
                  </p>

                  {micError && speechSupported && (
                    <p role="alert" className="mt-2 text-[13px] text-amber-900 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                      {micError}
                    </p>
                  )}

                  {!speechSupported && (
                    <p className="mt-2 text-[13px] text-amber-900 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                      Reconnaissance vocale non gérée par ce navigateur. Vous pouvez saisir votre réponse directement dans la zone de texte ci-dessous.
                    </p>
                  )}
                </div>

                {/* Transcript Input & Correction Box */}
                <div className="space-y-1.5">
                  <label htmlFor="editorial-interview-answer" className="block text-[13px] font-medium text-stone-800 flex justify-between">
                    <span>Votre réponse (modifiable)</span>
                    {transcript && (
                      <button
                        type="button"
                        onClick={() => setTranscript('')}
                        className="text-stone-700 hover:text-stone-900 text-[13px] underline flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw size={12} /> Effacer
                      </button>
                    )}
                  </label>
                  <textarea
                    id="editorial-interview-answer"
                    rows={4}
                    value={transcript + (interimTranscript ? ` (${interimTranscript}...)` : '')}
                    onChange={(e) => setTranscript(e.target.value)}
                    readOnly={isRecording}
                    placeholder="Votre réponse orale apparaîtra ici au fur et à mesure que vous parlez, ou écrivez-la directement..."
                    className="w-full rounded-lg border border-stone-300 bg-white p-3 text-sm text-stone-900 placeholder:text-stone-500 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-colors resize-y leading-relaxed"
                  />
                </div>

                {/* Claude Feedback Alert */}
                {evalFeedback && (
                  <div
                    role="status"
                    className={`p-3.5 rounded-lg border text-[13px] flex items-start gap-2.5 ${
                      evalFeedback.status === 'sufficient'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    {evalFeedback.status === 'sufficient' ? (
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
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
              {synthesizedResult && !isSynthesizing && (
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-stone-900">Votre ligne éditoriale est prête</h4>
                  <p className="text-[13px] text-stone-700 mt-0.5">
                    Relisez les cinq blocs ci-dessous. « Remplir les champs » les recopie dans le formulaire ; rien n&apos;est enregistré tant que vous n&apos;avez pas cliqué sur « Enregistrer la ligne éditoriale ».
                  </p>
                </div>
              )}

              {synthError && !isSynthesizing && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-[13px] text-red-800 space-y-3">
                  <p>{synthError}</p>
                  <button
                    type="button"
                    onClick={() => handleTriggerSynthesis(lastSummariesRef.current)}
                    className="inline-flex items-center gap-2 rounded-lg bg-stone-100 px-3 h-8 text-[13px] font-semibold text-stone-900 hover:bg-stone-200 cursor-pointer"
                  >
                    <RotateCcw size={13} /> Relancer la synthèse
                  </button>
                </div>
              )}

              {isSynthesizing ? (
                <div className="py-8">
                  <AiJobProgress
                    label="Rédaction de votre ligne éditoriale…"
                    elapsedSeconds={synthSeconds}
                    canLeave={false}
                  />
                </div>
              ) : synthesizedResult ? (
                <div className="space-y-4">
                  {[
                    { key: 'site_activity_context', label: '1. Activité et offre' },
                    { key: 'site_target_persona', label: '2. Clientèle visée' },
                    { key: 'site_tone_of_voice', label: "3. Ton et style d'écriture" },
                    { key: 'site_brand_tone', label: '4. Promesse et vocabulaire' },
                    { key: 'site_blog_topics', label: '5. Grands thèmes du blog' },
                  ].map((field) => (
                    <div key={field.key} className="border border-stone-200 rounded-xl p-3.5 bg-stone-50/50 space-y-1.5">
                      <h5 className="text-[13px] font-semibold text-stone-900 flex items-center gap-1.5">
                        <FileText size={14} className="text-stone-600" />
                        {field.label}
                      </h5>
                      <p className="text-[13px] text-stone-700 whitespace-pre-line leading-relaxed pl-5">
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
                className="px-3.5 h-10 rounded-lg text-[14px] font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-45 transition-colors cursor-pointer disabled:cursor-default"
              >
                Précédent
              </button>

              <button
                type="button"
                onClick={handleValidateAnswer}
                disabled={!transcript.trim() || isEvaluating}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg text-[14px] font-semibold disabled:opacity-50 transition-all cursor-pointer"
              >
                {isEvaluating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Analyse en cours…
                  </>
                ) : (
                  <>
                    Valider et continuer
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="flex items-center justify-end gap-3 w-full">
              <button
                type="button"
                onClick={requestClose}
                className="px-4 h-10 rounded-lg text-[14px] font-semibold text-stone-900 bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer"
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
                className="bg-accent hover:bg-accent-hover inline-flex items-center gap-2 px-5 py-2 rounded-lg text-accent-fg text-[14px] font-semibold disabled:opacity-50 transition-all cursor-pointer"
              >
                <Check size={16} />
                Remplir les champs
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
