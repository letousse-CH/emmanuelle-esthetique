"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
}

export default function VoiceInputButton({ onTranscript, className = '' }: VoiceInputButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  const recognitionRef = useRef<any>(null);
  const onTranscriptRef = useRef(onTranscript);

  // Keep ref up to date without re-triggering useEffect
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  // Initialize Web Speech API once (identical pattern as EditorialVoiceInterviewModal)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'fr-FR';

      recognition.onresult = (event: any) => {
        let finalConcat = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalConcat += event.results[i][0].transcript + ' ';
          }
        }

        if (finalConcat.trim()) {
          onTranscriptRef.current(finalConcat.trim());
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('[VoiceInputButton] Erreur :', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('[VoiceInputButton] Failed to initialize:', e);
      setSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
    };
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.warn('SpeechRecognition déjà actif', e);
        setIsRecording(true);
      }
    }
  };

  if (!speechSupported) {
    return (
      <button
        type="button"
        disabled
        className="p-2.5 rounded-[5px] bg-zinc-100 text-zinc-300 opacity-50 cursor-not-allowed"
        title="Dictée vocale non supportée par votre navigateur"
      >
        <MicOff size={18} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleRecording}
      title={isRecording ? "Microphone actif - Cliquez pour arrêter" : "Cliquez pour parler à voix haute"}
      className={`relative p-2.5 rounded-[5px] transition-all cursor-pointer shadow-xs flex items-center justify-center shrink-0 ${
        isRecording
          ? 'bg-red-600 text-white ring-2 ring-red-300 animate-pulse scale-105 shadow-red-500/20'
          : 'bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 active:scale-95'
      } ${className}`}
    >
      {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
      {isRecording && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-white"></span>
        </span>
      )}
    </button>
  );
}
