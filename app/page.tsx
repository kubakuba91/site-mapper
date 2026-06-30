"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import UrlInputForm, { type SubmitPayload } from "@/components/UrlInputForm";
import MappingBoard from "@/components/MappingBoard";
import ShareButton from "@/components/ShareButton";
import ExportButton from "@/components/ExportButton";
import ProgressCounter from "@/components/ProgressCounter";
import { createSession, loadSession, saveMappings } from "@/lib/sessions";
import type { CrawledPage, CrawlResult, Mapping } from "@/lib/types";

type CrawlState = {
  oldResult: CrawlResult | null;
  newResult: CrawlResult | null;
};

type MappingSuggestion = {
  id: string;
  oldPath: string;
  newPath: string;
  reason: string;
};

async function crawl(baseUrl: string, auth?: { username?: string; password?: string }): Promise<CrawlResult> {
  const res = await fetch("/api/crawl", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseUrl, auth }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error ?? `Crawl of ${baseUrl} failed`);
  }
  return res.json();
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Home />
    </Suspense>
  );
}

function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get("session");

  const [isLoading, setIsLoading] = useState(false);
  const [isRecrawling, setIsRecrawling] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(Boolean(sessionParam));
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CrawlState>({ oldResult: null, newResult: null });
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastSubmitPayload, setLastSubmitPayload] = useState<SubmitPayload | null>(null);
  const [reviewingSuggestions, setReviewingSuggestions] = useState(false);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!sessionParam) return;
    let cancelled = false;
    (async () => {
      try {
        const session = await loadSession(sessionParam);
        if (cancelled) return;
        setResult({
          oldResult: { baseUrl: session.oldBaseUrl, pages: session.oldPages, errors: [] },
          newResult: { baseUrl: session.newBaseUrl, pages: session.newPages, errors: [] },
        });
        setMappings(session.mappings);
        setSessionId(session.id);
        setLastSubmitPayload(null);
        setReviewingSuggestions(false);
        setSelectedSuggestionIds(new Set());
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load shared session");
      } finally {
        if (!cancelled) setIsLoadingSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionParam]);

  // Auto-save mapping edits to the shared session, debounced.
  useEffect(() => {
    if (!sessionId) return;
    const timer = setTimeout(() => {
      saveMappings(sessionId, mappings).catch(() => {
        /* best-effort autosave; user can still export locally */
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [sessionId, mappings]);

  async function handleSubmit(payload: SubmitPayload) {
    setIsLoading(true);
    setError(null);
    try {
      const [oldResult, newResult] = await Promise.all([
        crawl(payload.oldUrl),
        crawl(payload.newUrl, payload.newSiteAuth),
      ]);
      const suggestions = buildMappingSuggestions(oldResult.pages, newResult.pages);
      setResult({ oldResult, newResult });
      setMappings(oldResult.pages.map((p) => ({ oldPath: p.path, newPath: null, status: "unmatched" as const })));
      setSessionId(null);
      setLastSubmitPayload(payload);
      setSelectedSuggestionIds(new Set(suggestions.map((suggestion) => suggestion.id)));
      setReviewingSuggestions(suggestions.length > 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Crawl failed");
    } finally {
      setIsLoading(false);
    }
  }

  function normalizePath(raw: string): string {
    const trimmed = raw.trim();
    const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return withSlash.length > 1 && withSlash.endsWith("/") ? withSlash.slice(0, -1) : withSlash;
  }

  function handleAddOldPage(raw: string) {
    const oldResult = result.oldResult;
    if (!oldResult) return;
    const path = normalizePath(raw);
    if (oldResult.pages.some((p) => p.path === path)) return;
    const page = { url: `${oldResult.baseUrl}${path}`, path, title: null, description: null, statusCode: 0 };
    setResult((prev) =>
      prev.oldResult ? { ...prev, oldResult: { ...prev.oldResult, pages: [...prev.oldResult.pages, page] } } : prev,
    );
    setMappings((prev) => [...prev, { oldPath: path, newPath: null, status: "unmatched" as const }]);
  }

  function handleAddNewPage(raw: string) {
    const newResult = result.newResult;
    if (!newResult) return;
    const path = normalizePath(raw);
    if (newResult.pages.some((p) => p.path === path)) return;
    const page = { url: `${newResult.baseUrl}${path}`, path, title: null, description: null, statusCode: 0 };
    setResult((prev) =>
      prev.newResult ? { ...prev, newResult: { ...prev.newResult, pages: [...prev.newResult.pages, page] } } : prev,
    );
  }

  function handleStartOver() {
    setResult({ oldResult: null, newResult: null });
    setMappings([]);
    setSessionId(null);
    setLastSubmitPayload(null);
    setReviewingSuggestions(false);
    setSelectedSuggestionIds(new Set());
    router.replace("/");
  }

  async function handleRecrawl() {
    if (!result.oldResult || !result.newResult) return;

    setIsRecrawling(true);
    setError(null);
    try {
      const currentOldResult = result.oldResult;
      const currentNewResult = result.newResult;
      const currentMappings = mappings;
      const matchedOldPaths = new Set(
        currentMappings.filter((mapping) => mapping.status === "matched").map((mapping) => mapping.oldPath),
      );
      const matchedNewPaths = new Set(
        currentMappings
          .filter((mapping) => mapping.status === "matched" && mapping.newPath)
          .map((mapping) => mapping.newPath as string),
      );
      const [freshOldResult, freshNewResult] = await Promise.all([
        crawl(currentOldResult.baseUrl),
        crawl(currentNewResult.baseUrl, lastSubmitPayload?.newSiteAuth),
      ]);
      const oldPages = mergeRecrawledPages(freshOldResult.pages, currentOldResult.pages, matchedOldPaths);
      const newPages = mergeRecrawledPages(freshNewResult.pages, currentNewResult.pages, matchedNewPaths);

      setResult({
        oldResult: { ...freshOldResult, pages: oldPages },
        newResult: { ...freshNewResult, pages: newPages },
      });
      setMappings(mergeMappingsAfterRecrawl(currentMappings, oldPages));
      setSessionId(null);
      setReviewingSuggestions(false);
      setSelectedSuggestionIds(new Set());
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recrawl failed");
    } finally {
      setIsRecrawling(false);
    }
  }

  function toggleSuggestion(id: string) {
    setSelectedSuggestionIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applySuggestions(suggestions: MappingSuggestion[]) {
    const selectedByOldPath = new Map(
      suggestions
        .filter((suggestion) => selectedSuggestionIds.has(suggestion.id))
        .map((suggestion) => [suggestion.oldPath, suggestion.newPath]),
    );
    const oldPageByPath = new Map(result.oldResult?.pages.map((page) => [page.path, page]) ?? []);

    setMappings((prev) =>
      prev.map((mapping) => {
        const newPath = selectedByOldPath.get(mapping.oldPath);
        const oldPage = oldPageByPath.get(mapping.oldPath);
        return newPath
          ? {
              ...mapping,
              newPath,
              status: "matched" as const,
              metadataTitle: oldPage?.title ?? null,
              metadataDescription: oldPage?.description ?? null,
            }
          : mapping;
      }),
    );
    setReviewingSuggestions(false);
  }

  async function handleShare(): Promise<string> {
    if (!result.oldResult || !result.newResult) throw new Error("Nothing to share yet");
    let id = sessionId;
    if (!id) {
      id = await createSession({
        oldBaseUrl: result.oldResult.baseUrl,
        newBaseUrl: result.newResult.baseUrl,
        oldPages: result.oldResult.pages,
        newPages: result.newResult.pages,
        mappings,
      });
      setSessionId(id);
      router.replace(`/?session=${id}`);
    }
    return `${window.location.origin}${window.location.pathname}?session=${id}`;
  }

  if (isLoadingSession) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50">
        <p className="text-base font-medium text-neutral-600">Loading shared session…</p>
      </div>
    );
  }

  const hasResults = result.oldResult && result.newResult;

  if (hasResults) {
    const { oldResult, newResult } = result;
    const suggestions = buildMappingSuggestions(oldResult!.pages, newResult!.pages);
    let matched = 0;
    let dropped = 0;
    let unmatched = 0;
    for (const m of mappings) {
      if (m.status === "matched") matched++;
      else if (m.status === "dropped") dropped++;
      else unmatched++;
    }

    if (reviewingSuggestions) {
      return (
        <div className="flex h-screen flex-col bg-white">
          <header className="flex w-full items-center justify-between px-8 py-3.5">
            <div className="flex items-center gap-2.5">
              <HeaderLogo />
              <span className="rounded-md border border-[#E2E5EA] bg-white px-1.5 py-0.5 font-mono text-xs text-[#8A8F9A]">
                v1.0
              </span>
            </div>
            <button
              type="button"
              onClick={handleStartOver}
              className="border-b border-blue-200 pb-px font-mono text-[13px] text-blue-600"
            >
              ↺ Start over
            </button>
          </header>

          <div className="flex flex-wrap items-center gap-2.5 border-b border-[#EAECEF] px-8 pb-3.5">
            <DomainLink url={oldResult!.baseUrl} label="Open old site" />
            <span className="font-mono text-blue-600">→</span>
            <DomainLink url={newResult!.baseUrl} label="Open new site" />
            <CrawlErrorsBanner oldResult={oldResult!} newResult={newResult!} />
          </div>

          <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col overflow-hidden px-8 py-7">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="mb-2 font-mono text-xs font-medium uppercase tracking-[0.14em] text-blue-600">
                  Suggested connections
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-[#14161A]">
                  Review {suggestions.length} path-ending match{suggestions.length === 1 ? "" : "es"}.
                </h1>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setReviewingSuggestions(false)}
                  className="rounded-[10px] border border-[#E2E5EA] bg-white px-4 py-2 font-sans text-[13px] font-semibold text-[#525762] hover:bg-[#F7F8FA]"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={() => applySuggestions(suggestions)}
                  className="rounded-[10px] bg-blue-600 px-4 py-2 font-sans text-[13px] font-semibold text-white shadow-[0_6px_16px_-8px_rgba(37,99,235,0.5)] hover:brightness-95"
                >
                  Connect selected ({selectedSuggestionIds.size})
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto border-y border-[#EAECEF]">
              {suggestions.map((suggestion) => (
                <label
                  key={suggestion.id}
                  className="grid cursor-pointer grid-cols-[28px_minmax(0,1fr)_28px_minmax(0,1fr)_120px] items-center gap-3 border-b border-[#F1F3F5] py-3 text-sm last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedSuggestionIds.has(suggestion.id)}
                    onChange={() => toggleSuggestion(suggestion.id)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  <span className="truncate font-mono text-[13px] text-[#525762]">{suggestion.oldPath}</span>
                  <span className="text-center font-mono text-blue-600">→</span>
                  <span className="truncate font-mono text-[13px] text-[#14161A]">{suggestion.newPath}</span>
                  <span className="justify-self-end rounded-full border border-[#E4E7EC] px-2.5 py-1 font-mono text-[11px] text-[#6B7280]">
                    {suggestion.reason}
                  </span>
                </label>
              ))}
            </div>
          </main>
        </div>
      );
    }

    return (
      <div className="flex h-screen flex-col bg-white">
        <header className="flex w-full items-center justify-between px-8 py-3.5">
          <div className="flex items-center gap-2.5">
            <HeaderLogo />
            <span className="rounded-md border border-[#E2E5EA] bg-white px-1.5 py-0.5 font-mono text-xs text-[#8A8F9A]">
              v1.0
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleRecrawl}
              disabled={isRecrawling}
              className="inline-flex items-center gap-2 rounded-[10px] border border-[#E2E5EA] bg-white px-3.5 py-2 font-sans text-[13px] font-medium text-[#14161A] transition-colors hover:bg-[#F7F8FA] disabled:opacity-50"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M3 21v-5h5" />
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M16 8h5V3" />
              </svg>
              {isRecrawling ? "Recrawling..." : "Recrawl"}
            </button>
            <ShareButton onShare={handleShare} />
            <ExportButton oldPages={oldResult!.pages} newPages={newResult!.pages} mappings={mappings} />
          </div>
        </header>
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2.5 border-b border-[#EAECEF] px-8 pb-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <DomainLink url={oldResult!.baseUrl} label="Open old site" />
            <span className="font-mono text-blue-600">→</span>
            <DomainLink url={newResult!.baseUrl} label="Open new site" />
            <CrawlErrorsBanner oldResult={oldResult!} newResult={newResult!} />
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-3.5">
            <ProgressCounter matched={matched} dropped={dropped} unmatched={unmatched} total={oldResult!.pages.length} />
            <span className="text-[#D5D8DE]">·</span>
            <button
              type="button"
              onClick={handleStartOver}
              className="border-b border-blue-200 pb-px font-mono text-[13px] text-blue-600"
            >
              ↺ Start over
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <MappingBoard
            oldPages={oldResult!.pages}
            newPages={newResult!.pages}
            mappings={mappings}
            setMappings={setMappings}
            onAddOldPage={handleAddOldPage}
            onAddNewPage={handleAddNewPage}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-[#F4F5F7] text-[#14161A]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(20,22,26,0.055) 0.8px, transparent 0.8px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(120% 90% at 50% 0%, #000 35%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(120% 90% at 50% 0%, #000 35%, transparent 100%)",
        }}
      />

      <header className="relative z-10 mx-auto flex w-full max-w-[1140px] items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2.5">
          <HeaderLogo />
          <span className="rounded-md border border-[#E2E5EA] bg-white px-1.5 py-0.5 font-mono text-xs text-[#8A8F9A]">
            v1.0
          </span>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[1140px] flex-1 flex-wrap items-center justify-center gap-x-18 gap-y-14 px-8 py-10 pb-16">
        <section className="max-w-[520px] flex-1 basis-[380px]">
          <div className="mb-4.5 font-mono text-xs font-medium uppercase tracking-[0.16em] text-blue-600">
            Site migration toolkit
          </div>
          <h1 className="m-0 mb-5 text-[46px] font-semibold leading-[1.05] tracking-[-0.025em]">
            Map every old URL
            <br />
            to its new home.
          </h1>
          <p className="m-0 mb-8 max-w-[440px] text-base leading-relaxed text-[#525762]">
            Crawl your live site and its replacement, line up the matching pages, and export a clean set of 301
            redirects — so no link, ranking, or visitor gets lost in the move.
          </p>

          <div className="max-w-[460px] overflow-hidden rounded-[14px] border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(16,18,22,0.04)]">
            <div className="flex items-center gap-2 border-b border-[#EDEFF2] bg-[#FBFBFC] px-4 py-2.5">
              <span className="h-2 w-2 rounded-full bg-[#D5D8DE]" />
              <span className="h-2 w-2 rounded-full bg-[#D5D8DE]" />
              <span className="h-2 w-2 rounded-full bg-[#D5D8DE]" />
              <span className="ml-1.5 font-mono text-xs text-[#8A8F9A]">redirect-map.csv</span>
            </div>
            <div className="grid grid-cols-[1fr_22px_1fr] items-center px-4 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#A4A9B4]">
              <span>Old path</span>
              <span />
              <span>New path</span>
            </div>
            {[
              { old: "/about", new: "/company/about" },
              { old: "/blog/:slug", new: "/resources/:slug" },
              { old: "/contact", new: "/get-in-touch" },
              { old: "/pricing", new: "/plans" },
            ].map((row) => (
              <div
                key={row.old}
                className="grid grid-cols-[1fr_22px_1fr] items-center border-t border-[#F2F3F5] px-4 py-2.5 font-mono text-sm"
              >
                <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[#525762]">{row.old}</span>
                <span className="text-center text-blue-600">→</span>
                <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[#14161A]">{row.new}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {["Crawls both sites", "Side-by-side mapping", "One-click CSV"].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[#E4E7EC] bg-white px-3 py-1.5 font-mono text-xs text-[#5C616C]"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section className="min-w-[340px] flex-[0_1_460px]">
          <UrlInputForm onSubmit={handleSubmit} isLoading={isLoading} />
          {error && <p className="mx-auto mt-4 max-w-xl text-center text-sm font-semibold text-red-600">{error}</p>}
        </section>
      </main>
    </div>
  );
}

function HeaderLogo() {
  return (
    <img
      src="https://raw.githubusercontent.com/kubakuba91/site-mapper/main/Relay301%20(1).png"
      alt="Relay301"
      className="h-9 w-auto shrink-0"
    />
  );
}

function DomainLink({ url, label }: { url: string; label: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="truncate font-mono text-[13.5px] text-[#14161A]">{url}</span>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        aria-label={`${label}: ${url}`}
        title={`${label}: ${url}`}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-transparent text-[#8A8F9A] transition hover:border-[#DDE1E7] hover:bg-[#F7F8FA] hover:text-blue-600"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </a>
    </span>
  );
}

function CrawlErrorsBanner({ oldResult, newResult }: { oldResult: CrawlResult; newResult: CrawlResult }) {
  const totalErrors = oldResult.errors.length + newResult.errors.length;
  if (totalErrors === 0) return null;
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-[7px] border border-[#F6E0B8] bg-[#FEF3E2] px-2.5 py-1 font-mono text-xs text-[#B4540B]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#E0922F]" />
        {totalErrors} page{totalErrors === 1 ? "" : "s"} failed to load
        {newResult.errors.length > 0 ? " — staging may need login" : ""}.
      </summary>
      <ul className="mt-1.5 flex flex-col gap-1 pl-4 text-xs font-medium text-amber-800">
        {oldResult.errors.map((e) => (
          <li key={`old:${e.url}`} className="truncate">
            <span className="font-bold">old:</span> {e.url} — {e.reason}
          </li>
        ))}
        {newResult.errors.map((e) => (
          <li key={`new:${e.url}`} className="truncate">
            <span className="font-bold">new:</span> {e.url} — {e.reason}
          </li>
        ))}
      </ul>
    </details>
  );
}

function buildMappingSuggestions(oldPages: CrawledPage[], newPages: CrawledPage[]): MappingSuggestion[] {
  const newPagesByKey = new Map<string, CrawledPage[]>();

  for (const page of newPages) {
    for (const key of pathEndingKeys(page.path)) {
      const pages = newPagesByKey.get(key) ?? [];
      pages.push(page);
      newPagesByKey.set(key, pages);
    }
  }

  const suggestions: MappingSuggestion[] = [];
  const usedOldPaths = new Set<string>();
  const usedNewPaths = new Set<string>();

  for (const oldPage of oldPages) {
    if (usedOldPaths.has(oldPage.path)) continue;

    for (const key of pathEndingKeys(oldPage.path)) {
      const candidates = newPagesByKey.get(key) ?? [];
      const availableCandidates = candidates.filter((candidate) => !usedNewPaths.has(candidate.path));
      if (availableCandidates.length !== 1) continue;

      const newPage = availableCandidates[0];
      suggestions.push({
        id: `${oldPage.path}->${newPage.path}`,
        oldPath: oldPage.path,
        newPath: newPage.path,
        reason: suggestionReason(key),
      });
      usedOldPaths.add(oldPage.path);
      usedNewPaths.add(newPage.path);
      break;
    }
  }

  return suggestions;
}

function mergeRecrawledPages(
  freshPages: CrawledPage[],
  existingPages: CrawledPage[],
  existingPathsToPreserve: Set<string>,
): CrawledPage[] {
  const pagesByPath = new Map(freshPages.map((page) => [page.path, page]));
  const mergedPages = [...freshPages];

  for (const page of existingPages) {
    if (!existingPathsToPreserve.has(page.path) || pagesByPath.has(page.path)) continue;
    mergedPages.push(page);
    pagesByPath.set(page.path, page);
  }

  return mergedPages;
}

function mergeMappingsAfterRecrawl(currentMappings: Mapping[], oldPages: CrawledPage[]): Mapping[] {
  const mappingsByOldPath = new Map(currentMappings.map((mapping) => [mapping.oldPath, mapping]));

  return oldPages.map((page) => {
    const currentMapping = mappingsByOldPath.get(page.path);
    return currentMapping ?? { oldPath: page.path, newPath: null, status: "unmatched" as const };
  });
}

function pathEndingKeys(path: string): string[] {
  const normalized = normalizeComparablePath(path);
  if (normalized === "/") return ["exact:/"];

  const segments = normalized.split("/").filter(Boolean);
  const keys = [`exact:${normalized}`];
  for (const count of [3, 2, 1]) {
    if (segments.length >= count) {
      keys.push(`end:${count}:${segments.slice(-count).join("/")}`);
    }
  }
  return keys;
}

function normalizeComparablePath(path: string): string {
  const pathOnly = path.split("?")[0].split("#")[0];
  const withSlash = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
  const trimmed = withSlash.length > 1 && withSlash.endsWith("/") ? withSlash.slice(0, -1) : withSlash;
  return trimmed.toLowerCase();
}

function suggestionReason(key: string): string {
  if (key.startsWith("exact:")) return "same path";
  if (key.startsWith("end:3:")) return "same ending";
  if (key.startsWith("end:2:")) return "same ending";
  return "same slug";
}
