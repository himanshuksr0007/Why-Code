/**
 * Model-selection store.
 *
 * One shared store (read through `useSyncExternalStore`, like the chat
 * store) so the composer picker, the ask flow and the usage meter never
 * disagree about which model is active. The selection itself is kept in
 * localStorage; the models and the usage totals live on the server and
 * are fetched — nothing about a model is hard-coded in the UI.
 */

"use client";

import { useEffect, useSyncExternalStore } from "react";

import { hapticSelection } from "@/lib/haptics";

import {
  createCustomModel,
  deleteCustomModel,
  fetchModels,
  fetchUsage,
  getClientId,
  type CustomModelInput,
  type ModelInfo,
  type ModelsResponse,
  type UsageInfo,
} from "./api";

export interface ModelState {
  models: ModelsResponse | null;
  selectedId: string;
  usage: UsageInfo | null;
  /** False when the backend could not be reached at all. */
  reachable: boolean;
}

const SELECTION_KEY = "whycode:model-selection";
export const DEFAULT_MODEL_ID = "default";

const SERVER_STATE: ModelState = {
  models: null,
  selectedId: DEFAULT_MODEL_ID,
  usage: null,
  reachable: true,
};

let state: ModelState = SERVER_STATE;
let started = false;
const listeners = new Set<() => void>();

function emit(next: ModelState) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ModelState {
  return state;
}

function getServerSnapshot(): ModelState {
  return SERVER_STATE;
}

function readSelection(): string {
  try {
    return window.localStorage.getItem(SELECTION_KEY) ?? DEFAULT_MODEL_ID;
  } catch {
    return DEFAULT_MODEL_ID;
  }
}

function persistSelection(id: string) {
  try {
    window.localStorage.setItem(SELECTION_KEY, id);
  } catch {
    // private mode etc. — selection just won't survive a reload
  }
}

export async function refreshModels(): Promise<void> {
  const clientId = getClientId();
  try {
    const models = await fetchModels(clientId);
    let selectedId = state.selectedId;
    if (
      selectedId !== DEFAULT_MODEL_ID &&
      !models.custom.some((model) => model.id === selectedId)
    ) {
      selectedId = DEFAULT_MODEL_ID;
      persistSelection(selectedId);
    }
    emit({ ...state, models, selectedId, reachable: true });
  } catch {
    emit({ ...state, reachable: false });
  }
}

export async function refreshUsage(): Promise<void> {
  const clientId = getClientId();
  if (!clientId) return;
  try {
    const usage = await fetchUsage(clientId, state.selectedId);
    emit({ ...state, usage });
  } catch {
    // usage is best-effort; a failed read leaves the last totals in place
  }
}

export function selectModel(id: string): void {
  persistSelection(id);
  emit({ ...state, selectedId: id });
  void refreshUsage();
  hapticSelection();
}

export async function addCustomModel(input: CustomModelInput): Promise<ModelInfo> {
  const created = await createCustomModel(getClientId(), input);
  await refreshModels();
  selectModel(created.id);
  return created;
}

export async function removeCustomModel(id: string): Promise<void> {
  await deleteCustomModel(getClientId(), id);
  if (state.selectedId === id) {
    persistSelection(DEFAULT_MODEL_ID);
    emit({ ...state, selectedId: DEFAULT_MODEL_ID });
  }
  await refreshModels();
  void refreshUsage();
}

function start() {
  if (started) return;
  started = true;
  emit({ ...state, selectedId: readSelection() });
  void refreshModels().then(() => refreshUsage());
}

export function useModelSelection(): ModelState & {
  selectedModel: ModelInfo | null;
  selectModel: typeof selectModel;
  addCustomModel: typeof addCustomModel;
  removeCustomModel: typeof removeCustomModel;
  refreshUsage: typeof refreshUsage;
} {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(start, []);
  const selectedModel =
    snapshot.selectedId === DEFAULT_MODEL_ID
      ? snapshot.models?.default ?? null
      : snapshot.models?.custom.find((m) => m.id === snapshot.selectedId) ?? null;
  return {
    ...snapshot,
    selectedModel,
    selectModel,
    addCustomModel,
    removeCustomModel,
    refreshUsage,
  };
}
