"use client";

import { WebHaptics } from "web-haptics";

import { hapticsEnabled } from "./store";

export { useHapticsEnabled, setHapticsEnabled, hapticsEnabled } from "./store";

/**
 * Haptic feedback for the whole app, modeled on what production
 * sites that vibrate on Android actually do:
 *
 *  - Devices with the Vibration API (Android Chrome and friends):
 *    call `navigator.vibrate()` DIRECTLY, synchronously, with
 *    plain number patterns in the 50–200 ms range that demos and
 *    PWAs have proven out. No library sits between the tap and the
 *    call: the earlier library route compiled its presets down to
 *    as little as 2 ms of motor time, which real hardware ignores.
 *  - iOS Safari has no Vibration API at all, so there the
 *    web-haptics instance provides the feedback through its hidden
 *    switch element (iOS 17.4+ system haptic).
 *  - Desktops dispatch the same calls; machines without a vibration
 *    motor stay silent, and nothing ever throws.
 *
 * Every helper respects the Settings → Haptics preference
 * (enabled by default).
 */

let iosEngine: WebHaptics | null = null;

function getIosEngine(): WebHaptics | null {
  if (typeof window === "undefined") return null;
  if (!iosEngine) {
    try {
      iosEngine = new WebHaptics();
    } catch {
      iosEngine = null;
    }
  }
  return iosEngine;
}

export type HapticPresetName =
  | "success"
  | "warning"
  | "error"
  | "light"
  | "medium"
  | "heavy"
  | "soft"
  | "rigid"
  | "selection"
  | "nudge";

/** Plain vibrate() patterns: durations and pauses in ms. */
const VIBRATE_PATTERNS: Record<HapticPresetName, number | number[]> = {
  selection: 50,
  light: 60,
  medium: 90,
  heavy: 140,
  soft: 70,
  rigid: 50,
  success: [70, 60, 110],
  warning: [100, 60, 100],
  error: [110, 50, 110, 50, 110],
  nudge: [120, 70, 60],
};

/** The same shapes for the iOS switch engine (duration/delay form). */
const IOS_PATTERNS: Record<
  HapticPresetName,
  { duration: number; delay?: number }[]
> = {
  selection: [{ duration: 50 }],
  light: [{ duration: 60 }],
  medium: [{ duration: 90 }],
  heavy: [{ duration: 140 }],
  soft: [{ duration: 70 }],
  rigid: [{ duration: 50 }],
  success: [{ duration: 70 }, { delay: 60, duration: 110 }],
  warning: [{ duration: 100 }, { delay: 60, duration: 100 }],
  error: [
    { duration: 110 },
    { delay: 50, duration: 110 },
    { delay: 50, duration: 110 },
  ],
  nudge: [{ duration: 120 }, { delay: 70, duration: 60 }],
};

function hasVibrate(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.vibrate === "function"
  );
}

export function haptic(preset: HapticPresetName): void {
  if (!hapticsEnabled()) return;
  try {
    if (hasVibrate()) {
      navigator.vibrate(VIBRATE_PATTERNS[preset]);
      return;
    }
    const engine = getIosEngine();
    if (engine) void engine.trigger(IOS_PATTERNS[preset], { intensity: 1 });
  } catch {
    // Haptics are decoration; a failure must never surface.
  }
}

export const hapticSelection = () => haptic("selection");
export const hapticLight = () => haptic("light");
export const hapticMedium = () => haptic("medium");
export const hapticSuccess = () => haptic("success");
export const hapticWarning = () => haptic("warning");
export const hapticError = () => haptic("error");

/** How this device will receive haptics, for the Settings caption. */
export type HapticSupport = "vibration" | "ios" | "none";

export function hapticSupport(): HapticSupport {
  if (typeof navigator === "undefined") return "none";
  if (hasVibrate()) return "vibration";
  const ua = navigator.userAgent;
  const isIOS =
    /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return isIOS ? "ios" : "none";
}

export interface HapticDiagnostic {
  support: HapticSupport;
  /** What `navigator.vibrate(200)` returned; null on the iOS path. */
  accepted: boolean | null;
}

/**
 * The ground-truth probe behind the Settings "Test haptics" button:
 * one plain, unmistakable 200 ms buzz — the canonical demo call —
 * issued directly, reporting whether the browser accepted it.
 */
export function runHapticDiagnostic(): HapticDiagnostic {
  const support = hapticSupport();
  if (support === "vibration") {
    let accepted: boolean | null = null;
    try {
      accepted = navigator.vibrate(200);
    } catch {
      accepted = false;
    }
    return { support, accepted };
  }
  if (support === "ios") {
    const engine = getIosEngine();
    if (engine) {
      try {
        void engine.trigger([{ duration: 200 }], { intensity: 1 });
      } catch {
        // surfaced as accepted=null either way on this path
      }
    }
    return { support, accepted: null };
  }
  return { support, accepted: false };
}
