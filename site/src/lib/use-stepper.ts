"use client";

import { useEffect, useRef, useState } from "react";

import { useReducedMotion } from "@/lib/use-reduced-motion";

/**
 * Drives a step-by-step diagram: advances on a timer while the diagram is on
 * screen, pauses on hover/focus, and lets the visitor jump to any step.
 * With reduced motion it never auto-advances and shows the final step until
 * the visitor picks one.
 */
export function useStepper(count: number, ms = 2600) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.35,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || paused || !visible) return;
    const hold = step === count - 1 ? ms * 1.8 : ms;
    const timer = window.setTimeout(() => setStep((s) => (s + 1) % count), hold);
    return () => window.clearTimeout(timer);
  }, [step, reduced, paused, visible, count, ms]);

  const current = reduced ? (picked ?? count - 1) : step;

  return {
    ref,
    step: current,
    reduced,
    paused,
    setPaused,
    go: (index: number) => {
      setPicked(index);
      setStep(index);
    },
  };
}

export type Stepper = ReturnType<typeof useStepper>;
