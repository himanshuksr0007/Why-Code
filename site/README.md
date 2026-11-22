# Why-Code website

The public marketing and documentation site (separate from the product app in
`frontend/`). Static Next.js pages, black-and-white theme.

| Route | Content |
| --- | --- |
| `/` | Plain-words explanation, animated working model, what you get, honest teaser |
| `/how-it-works` | Find → check → record → use, each step with its own animated diagram (miners, git currency, ledger, retrieval, validator) |
| `/technology` | Animated architecture diagram, an explorer with an animated diagram per component (git, miners, tree-sitter, Neo4j, ledger, hybrid retrieval, DistilBERT, LLM + validator, MCP, GitHub Action) — how it works and how Why-Code uses it — and an honest status table |
| `/compare` | Why-Code vs. ChatGPT & Claude: animated chat-vs-record and “switch the model off” diagrams, the feature table, and where Why-Code falls short |
| `/docs` | Quick start for the ledger, PR block, GitHub Action, MCP and API, with copyable code blocks and an on-this-page index that follows your scroll |

```bash
cd site
npm install
npm run dev      # http://localhost:3001
npm run build && npm start
```

Every page is statically rendered. Motion lives in small client components:
the header, the pipeline animation, the ask replay, scroll reveals
(`components/reveal.tsx`) and the step-by-step SVG diagrams
(`components/diagrams/`, built from the primitives in `kit.tsx` and driven by
`lib/use-stepper.ts`). Diagrams advance only while on screen, pause on hover or
focus, and can be stepped by hand. All of it honours `prefers-reduced-motion`:
diagrams show their final step, nothing moves, and reveals are skipped.

Technology copy (what each piece is, how it works, how Why-Code uses it, its
status) lives in `src/lib/tech.ts`; update it there and both the explorer and
the status table follow.
