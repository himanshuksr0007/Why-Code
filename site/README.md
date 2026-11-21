# Why-Code website

The public marketing and documentation site (separate from the product app in
`frontend/`). Static Next.js pages, black-and-white theme.

| Route | Content |
| --- | --- |
| `/` | Plain-words explanation, animated working model, what you get, honest teaser |
| `/how-it-works` | Find → check → record → use, with the same animation |
| `/technology` | Each component (git, tree-sitter, Neo4j, ledger, retrieval, MCP, …) with honest status |
| `/compare` | Why-Code vs. ChatGPT & Claude, including where Why-Code falls short |
| `/docs` | Quick start for the ledger, PR block, GitHub Action, MCP and API |

```bash
cd site
npm install
npm run dev      # http://localhost:3001
npm run build && npm start
```

Every page is statically rendered; the only client components are the header,
the pipeline animation and the ask replay, all of which honour
`prefers-reduced-motion`.
