"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Voice input for the composer, on the browser's Web Speech API
 * (SpeechRecognition — Chrome/Edge/Safari; Firefox has none, and the
 * button explains that instead of pretending). Dictation streams
 * into the draft: final segments accumulate, the interim segment is
 * shown live and replaced as it settles. Starting captures the
 * current draft as the base text, so dictation appends instead of
 * wiping what was typed.
 */

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function recognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as Record<string, unknown>;
  const ctor = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
  return typeof ctor === "function" ? (ctor as SpeechRecognitionCtor) : null;
}

export function useSpeechInput({
  valueRef,
  onChange,
}: {
  /** Always-current draft text (a ref — the recognizer outlives renders). */
  valueRef: React.RefObject<string>;
  onChange: (value: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);
  const baseRef = useRef("");
  const finalRef = useRef("");
  const supported = recognitionCtor() !== null;

  const stop = useCallback(() => {
    listeningRef.current = false;
    setListening(false);
    try {
      recognitionRef.current?.stop();
    } catch {
      // Already stopped.
    }
    recognitionRef.current = null;
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      toast.error("Voice input is not supported in this browser");
      return;
    }
    const recognition = new Ctor();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    const base = (valueRef.current ?? "").replace(/\s+$/, "");
    baseRef.current = base ? `${base} ` : "";
    finalRef.current = "";
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalRef.current += transcript.replace(/^\s+/, "") + " ";
        } else {
          interim += transcript;
        }
      }
      onChange(baseRef.current + finalRef.current + interim);
    };
    recognition.onend = () => {
      // Chrome ends recognition after pauses; while the user still
      // wants to dictate, quietly restart it.
      if (listeningRef.current) {
        try {
          recognition.start();
        } catch {
          // A restart raced a stop — nothing to do.
        }
      }
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        toast.error("Microphone access was blocked — allow it in the browser to dictate");
        stop();
      } else if (event.error === "audio-capture") {
        toast.error("No microphone was found");
        stop();
      }
      // "no-speech" / "aborted" are routine — onend handles them.
    };
    recognitionRef.current = recognition;
    listeningRef.current = true;
    setListening(true);
    try {
      recognition.start();
    } catch {
      stop();
    }
  }, [onChange, stop, valueRef]);

  const toggle = useCallback(() => {
    if (listeningRef.current) stop();
    else start();
  }, [start, stop]);

  useEffect(() => {
    return () => {
      listeningRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch {
        // Already stopped.
      }
    };
  }, []);

  return { supported, listening, toggle, stop };
}
