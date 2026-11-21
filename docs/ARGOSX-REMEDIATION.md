# ArgosX remediation

Baseline is the 21 November 2026 public-surface scan. That scan excluded signed-in flows.

| Finding | Remediation |
| --- | --- |
| `457451`, `35b6e2` — landmarks | The app shell provides a main landmark on standalone routes and while page content streams. The mobile toolbar uses a header. Existing classes and layout are preserved. |
| `373ec4` — text contrast | Scoped light-theme foreground changes cover the auth demo tabs, contributor initials, change statuses and stats, and the not-found action. Backgrounds, typography and spacing are preserved. |
| `cba35c` — CSP | Added a report-only policy for scripts, styles, images, API connections and frames. Production policy excludes `unsafe-eval`. Inline scripts and styles currently support Next.js bootstrapping and Clerk. |
| `00b3d5`, `15bf5f` — canonical and Open Graph | Pages emit their canonical production URLs and share metadata. The 1200 × 630 share image uses the existing WhyCode artwork. |
| `167330`, `e13183` — robots and sitemap | `/robots.txt` references the sitemap, which lists Ask, Code changes, People, sign-in and sign-up. Account settings, auth callbacks and shared chats are excluded from the sitemap. |
| `cca83d`, `8086da` — reported typos | Keep `httpx`, `jline`, `bootcheck`, `plandescription`, `systemgraph`, `pagecache`, `batchimport`, `storageengine` and `labelscan` as repository names or upstream commit text. The changes feed and contributor history use the first line of the GitHub commit message directly, with no word concatenation. |
| Earlier unauthenticated `/api/v1/usage` | The session check from `5f06be2` is retained. The local production API returns `401` for a logged-out request. |

## CSP rollout

The default `Content-Security-Policy-Report-Only` header lets the browser report violations without blocking requests. Check production Ask and evidence, public and private shares, Clerk email/Google/GitHub sign-in, and sign-up with its CAPTCHA before enabling enforcement. Set `WHYCODE_CSP_MODE=enforce` on the frontend deployment and rebuild once those checks pass. Verify the `Content-Security-Policy` response header and repeat the click-through before running the final ArgosX scan.

## Local verification

- Axe checked the main landmark, landmark containment and text contrast on public and standalone routes in Firefox. The populated Changes view rendered 20 commit cards and the contributor profile rendered 10 cards without violations of those rules. The tested pages also produced no CSP violation events under local enforcement.
- Example light-theme contrast ratios calculated from the rendered colors are 2.80 → 5.28 for active demo tabs and 4.35 → 4.99 for muted text on the change cards.
- Canonical and Open Graph URLs matched all five public pages. The sitemap, robots file and preview image returned HTTP 200.
- Frontend build and typecheck passed. The 14 targeted backend model and auth tests passed. Live deployment, signed-in Clerk flows and the final ArgosX rescan are pending.
