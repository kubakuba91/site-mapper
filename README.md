# Relay301

Crawl two public websites, review suggested URL mappings, connect or drop pages, and export a mapping CSV. Sharing is optional.

## Run locally

Use Node.js 22 or newer.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Without Supabase configuration, crawling, mapping and CSV export work locally. Share reports that it is not configured. Basic-auth credentials remain in the current tab and are sent only to the explicitly entered staging origin; they are never stored in shared sessions.

## Supabase setup and migration

1. Run `supabase/schema.sql` in the Supabase SQL editor. For an existing installation, `supabase/migrations/20260927_secure_sessions.sql` is the equivalent migration.
2. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` using the project's public URL and anon/publishable key. Never put a service-role key in a public environment variable.
3. Build/deploy the app with these environment variables.

**Existing installations:** export any important open boards before applying the migration. It revokes the old unrestricted anonymous table policies and intentionally disables legacy ID-only share links. Existing rows remain in the database for administrator recovery, but cannot be claimed anonymously. Re-share boards with the new application. Deploy the migration and application together.

New links contain a random 256-bit capability in the URL fragment (`#key=…`), which is not sent to the app server or in referrer headers. Anyone given the full link can read and edit that one board. The database stores only its hash; clients use narrowly scoped RPC functions and have no direct table permissions. New snapshots save both page inventories and mappings atomically. Revision checks reject stale writes; a conflict or failed save is displayed rather than silently discarding work. Export local work before reloading after a conflict. Loading a board does not itself save it.

The app serializes autosaves, warns before leaving with unsaved shared edits, and flushes saves before re-sharing or starting over. Wait for **Saved** before closing a shared board. This is not a real-time collaborative editor. Unshared work remains in memory; export before refreshing.

## Crawler behavior and limits

- Public HTTP(S) destinations on ports 80/443 only; loopback, private, link-local, mapped private IPv6, and reserved addresses are blocked.
- Every request and redirect resolves and validates DNS, then pins its socket to the validated address. HTTPS downgrade redirects are rejected. Basic-auth headers are attached only on the originally authorized origin.
- Same-origin sitemap entries only. HTML links are resolved using the final response URL and HTML base URL.
- Maximum 200 pages, link depth 4, 8 concurrent page requests, 20 sitemap files, sitemap nesting 4, 5 redirects, 2 MB per response, 20 MB downloaded per crawl, XML nesting 50, 45 seconds per request including its body, 240 seconds per crawl.
- The UI reports failed pages and incomplete inventories. Large sites require a different crawl budget/workflow; a limited crawl is not a complete migration inventory.
- JavaScript-only rendered links are not discovered. The crawler parses returned HTML, not a full browser-rendered page.
- Each server process admits at most 4 active crawls and 20 starts/minute. For a public deployment, configure hosting-level distributed rate limits: process-local limits do not aggregate across serverless instances. Use network egress restrictions as additional protection.
- Recrawl temporarily locks board editing. It retains mapped/dropped and manual pages, keeps shared-session access, and preserves the board when a site cannot be crawled. Credentials for protected staging can be re-entered on the board.

## Export

The default **Spreadsheet-safe** CSV prefixes formula-leading cells for safe review. Disable that option only for a raw machine-import CSV that must preserve literal metadata. Do not open untrusted raw CSV in spreadsheet software. The CSV is a mapping document, not deployable Nginx, Apache, or Vercel configuration; convert it for your hosting platform.

## Verification

```sh
npm test                 # parsing, network boundaries, CSV, exact crawl limits, PostgreSQL migration
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:browser     # starts a local test app; crawler and Supabase responses are mocked
npm audit
```

The PostgreSQL tests use isolated PGlite instances, including anonymous-role queries, capability checks, full snapshot saves and stale-write rejection. Network tests use controlled local fixtures through a substituted test transport; there is no production private-network bypass. Browser tests check keyboard/mobile mapping, recrawl locking, exports, manual pages, save/reload and conflict visibility. Browser tests use placeholder Supabase settings and never access real customer sessions.

Before production rollout, verify the migration and new share links against an isolated Supabase project, then apply it to the intended deployment. The code and isolated tests cannot confirm a remote database's actual policies without access to that project.
