"use client";

import { EvidenceProvider } from "@/components/evidence/evidence-provider";
import { PullRequestProvider } from "@/components/pull-request/pull-request-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delay={150}>
      <EvidenceProvider>
        <PullRequestProvider>
          {children}
          <Toaster position="bottom-right" />
        </PullRequestProvider>
      </EvidenceProvider>
    </TooltipProvider>
  );
}
