# QA remediation — September 2026

This change addresses the 14 findings from the audit of `b89beb9`.

| Finding | Change | Verification |
|---|---|---|
| Anonymous session enumeration/editing | Direct table grants and permissive policies revoked; hashed 256-bit capability required by RPCs | Isolated PostgreSQL role/permission tests |
| Crawler SSRF | Public address validation, pinned DNS, standard ports, redirect revalidation | IPv4/IPv6, alternate IP notation, mixed DNS and redirect tests |
| Cross-origin credential leakage | Credentials scoped to the original origin; foreign sitemap entries skipped | Local transport header capture and sitemap tests |
| Vulnerable dependencies | Updated Next.js/parser and lockfile | npm audit |
| Manual pages not saved | Atomic full snapshot saves, serialized autosave, visible errors | PostgreSQL snapshot and browser save/reload tests |
| Recrawl loses edits | Editing and Start over locked during recrawl; shared access retained | Delayed browser requests and disabled-control assertions |
| Double-slash manual URLs | Validated origin-relative URL construction | Unit and browser link assertions |
| Corrupt metadata | HTML parser handles quotes and entity decoding | Apostrophe/entity fixtures |
| Wrong relative link resolution | Final response URL and HTML base used | Redirect/directory fixture |
| Body timeout/resource limits | Cancellation covers DNS/socket/body; byte, recursion, concurrency and time budgets | Stalled body, oversized body and crawl-limit tests |
| CSV formulas | Spreadsheet-safe default; separately labeled raw export | CSV formula/CR escaping tests |
| Keyboard mapping inaccessible | Explicit keyboard-operable mapping/drop/restore controls | Browser Enter-key workflow |
| Mobile layout clipped | Source/target panels, wrapping header, full path text | 390px browser flow and screenshot |
| Malformed JSON shapes cause 500s | Runtime shape/URL/auth checks and request-size cap | Unit validation and browser API tests |

Additional improvements: exact concurrent page limits, incomplete-crawl notices, preserved manual/dropped pages on recrawl, basic-auth re-entry, no save on session load, optimistic revisions, export before leaving on save failure, bundled logo, setup documentation and a GitHub Actions QA workflow.

## Rollout requirement

Run `supabase/migrations/20260927_secure_sessions.sql` and deploy the application together. Export important existing open boards first. Legacy ID-only links are intentionally invalidated; existing rows are retained for administrator recovery. This migration has been exercised against an isolated PostgreSQL runtime, not the production Supabase project. See the README for configuration and deployment-level rate limits.
