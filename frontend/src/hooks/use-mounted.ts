"use client";

import { useSyncExternalStore } from "react";

/**
 * `false` during server rendering and the hydration pass, `true` afterwards.
 *
 * Used for values that only exist on the client (resolved theme, stored
 * profiles) so the first client render matches the server HTML exactly —
 * without a state-setting effect, which the lint rules disallow.
 */
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
