import { CopyCode } from "@/components/copy-code";
import { DocsToc } from "@/components/docs-toc";
import { PageHero, Section } from "@/components/ui";
import { SITE } from "@/lib/site";

export const metadata = { title: "Docs" };

const TOC = [
  ["#index", "Index a repository"],
  ["#ask", "Ask why"],
  ["#govern", "Accept, pin, dismiss"],
  ["#pr", "Pull-request decisions block"],
  ["#action", "GitHub Action"],
  ["#mcp", "Coding agents (MCP)"],
  ["#api", "HTTP API"],
] as const;

export default function DocsPage() {
  return (
    <>
      <PageHero
        eyebrow="Docs"
        title="Quick start."
        intro="Everything here runs from the backend/ folder of the repository, with Python 3.12+. The ledger needs no AI key and no Neo4j."
      />

      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[13rem_1fr]">
        <DocsToc items={TOC} />

        <div className="min-w-0 [&>section]:px-0">
          <Section id="index" eyebrow="1" title="Index a repository">
            <CopyCode code={`git clone ${SITE.repoUrl}
cd why-code/backend
python -m venv .venv && . .venv/bin/activate
pip install -e .
python -m app.ledger index ../path/to/your-repo --repo owner/name`} />
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              Mines ADRs, <code className="font-mono text-ink">WHY:</code> comments and commits, verifies each quote and
              computes currency. Re-running is safe: duplicates merge, dismissed decisions stay dismissed.
            </p>
          </Section>

          <Section id="ask" eyebrow="2" title="Ask why">
            <CopyCode code={`python -m app.ledger why src/payments/charge.py   # decisions over a path
python -m app.ledger why -q "why idempotency keys"   # ranked search
python -m app.ledger why                             # governance health`} />
          </Section>

          <Section id="govern" eyebrow="3" title="Accept, pin, dismiss">
            <CopyCode code={`python -m app.ledger accept dec_1a2b --reason "still true" --scope src/payments/
python -m app.ledger pin dec_1a2b --reason "money handling is law"
python -m app.ledger dismiss dec_9f8e --reason "not a decision"
python -m app.ledger show dec_1a2b                  # includes the authority log
python -m app.ledger export --path ../your-repo     # writes .whycode/decisions.yaml`} />
          </Section>

          <Section id="pr" eyebrow="4" title="Pull-request decisions block">
            <CopyCode code={`<!-- whycode:decisions -->
- Retries live in the HTTP client, not in callers. Why: callers set different
  timeouts and three of them forgot to retry. Files: app/client.py, app/jobs/
<!-- /whycode:decisions -->`} />
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              Up to five bullets. With the webhook configured, the entries are proposed when the PR opens and come into
              force when it merges.
            </p>
          </Section>

          <Section id="action" eyebrow="5" title="GitHub Action">
            <CopyCode code={`on: pull_request
permissions: { contents: read, pull-requests: write }
jobs:
  decisions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: himanshuksr0007/why-code@main`} />
          </Section>

          <Section id="mcp" eyebrow="6" title="Coding agents (MCP)">
            <CopyCode code={`claude mcp add whycode -- python -m app.ledger mcp \\
  --db /abs/path/ledger.db --repo owner/name`} />
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              Tools: <code className="font-mono text-ink">get_why</code>,{" "}
              <code className="font-mono text-ink">search_decisions</code>,{" "}
              <code className="font-mono text-ink">check_change</code>,{" "}
              <code className="font-mono text-ink">record_decision</code>. Run it from <code className="font-mono text-ink">backend/</code>.
            </p>
          </Section>

          <Section id="api" eyebrow="7" title="HTTP API">
            <CopyCode code={`GET  /api/v1/ledger/why?repo=owner/name&query=...&targets=path
GET  /api/v1/ledger/decisions?repo=owner/name&currency=needs_review
GET  /api/v1/ledger/decisions/{id}          # with authority log
POST /api/v1/ledger/check                   # { repo, changed_files, pr_body }
POST /api/v1/ledger/decisions/{id}/pin      # Bearer $WHYCODE_LEDGER_ADMIN_TOKEN`} />
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              Full reference:{" "}
              <a href={SITE.docsLedger} className="text-ink underline">
                docs/DECISION_LEDGER.md
              </a>
              .
            </p>
          </Section>
        </div>
      </div>
    </>
  );
}
