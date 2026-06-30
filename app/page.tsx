"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import UrlInputForm, { type SubmitPayload } from "@/components/UrlInputForm";
import MappingBoard from "@/components/MappingBoard";
import ShareButton from "@/components/ShareButton";
import { createSession, loadSession, saveMappings } from "@/lib/sessions";
import type { CrawlResult, Mapping } from "@/lib/types";

type CrawlState = {
  oldResult: CrawlResult | null;
  newResult: CrawlResult | null;
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
  const [isLoadingSession, setIsLoadingSession] = useState(Boolean(sessionParam));
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CrawlState>({ oldResult: null, newResult: null });
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

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
      setResult({ oldResult, newResult });
      setMappings(oldResult.pages.map((p) => ({ oldPath: p.path, newPath: null, status: "unmatched" as const })));
      setSessionId(null);
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
    router.replace("/");
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
    return (
      <div className="flex h-screen flex-col bg-white">
        <div className="flex flex-col gap-1.5 border-b-2 border-neutral-200 px-4 py-4">
          <h1 className="text-xl font-bold text-neutral-900">Redirect Mapper</h1>
          <div className="flex flex-wrap gap-3 text-sm font-medium text-neutral-600">
            <span>{oldResult!.baseUrl}</span>
            <span>→</span>
            <span>{newResult!.baseUrl}</span>
          </div>
          <CrawlErrorsBanner oldResult={oldResult!} newResult={newResult!} />
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleStartOver}
            className="self-start text-sm font-bold text-blue-700 underline"
          >
            Start over
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <MappingBoard
            oldPages={oldResult!.pages}
            newPages={newResult!.pages}
            mappings={mappings}
            setMappings={setMappings}
            headerExtra={<ShareButton onShare={handleShare} />}
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
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-blue-600 text-base font-semibold text-white shadow-[0_2px_8px_-2px_rgba(37,99,235,0.2)]">
            ↳
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Redirect Mapper</span>
          <span className="rounded-md border border-[#E2E5EA] bg-white px-1.5 py-0.5 font-mono text-xs text-[#8A8F9A]">
            v1.0
          </span>
        </div>
        <nav className="flex items-center gap-6 font-mono text-sm text-[#5C616C]">
          <span>crawl</span>
          <span>map</span>
          <span>export</span>
        </nav>
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

function CrawlErrorsBanner({ oldResult, newResult }: { oldResult: CrawlResult; newResult: CrawlResult }) {
  const totalErrors = oldResult.errors.length + newResult.errors.length;
  if (totalErrors === 0) return null;
  return (
    <details className="text-sm font-semibold text-amber-700">
      <summary className="cursor-pointer">
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
