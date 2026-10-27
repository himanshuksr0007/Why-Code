"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { EvidenceSheet } from "@/components/evidence/evidence-sheet";

import type { EvidenceDetail } from "@/lib/api/types";

interface EvidencePanelValue {
  openEvidence: (evidenceId: string, initialDetail?: Partial<EvidenceDetail>) => void;
}

const EvidencePanelContext = createContext<EvidencePanelValue | null>(null);

export function useEvidencePanel(): EvidencePanelValue {
  const value = useContext(EvidencePanelContext);
  if (!value) {
    throw new Error("useEvidencePanel must be used inside <EvidenceProvider>");
  }
  return value;
}

/**
 * App-wide evidence panel. Any citation anywhere can open it, so the sheet is
 * mounted once instead of per screen.
 */
export function EvidenceProvider({ children }: { children: React.ReactNode }) {
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [initialDetail, setInitialDetail] = useState<Partial<EvidenceDetail> | undefined>(undefined);

  const openEvidence = useCallback((id: string, initial?: Partial<EvidenceDetail>) => {
    setEvidenceId(id);
    setInitialDetail(initial);
  }, []);

  const value = useMemo<EvidencePanelValue>(
    () => ({ openEvidence }),
    [openEvidence],
  );

  return (
    <EvidencePanelContext.Provider value={value}>
      {children}
      <EvidenceSheet
        evidenceId={evidenceId}
        initialDetail={initialDetail}
        onOpenChange={(open) => {
          if (!open) {
            setEvidenceId(null);
            setInitialDetail(undefined);
          }
        }}
      />
    </EvidencePanelContext.Provider>
  );
}
