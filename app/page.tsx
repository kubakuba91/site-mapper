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
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-24">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-extrabold text-neutral-900">Redirect Mapper</h1>
        <p className="mt-2 max-w-md text-base text-neutral-600">
          Map old-site URLs to new-site URLs for a relaunch. Crawl both sites, draw the mapping, export a CSV.
        </p>
      </div>
      <div className="w-full rounded-xl border-2 border-neutral-200 bg-white p-8 shadow-sm">
        <UrlInputForm onSubmit={handleSubmit} isLoading={isLoading} />
        {error && <p className="mx-auto mt-4 max-w-xl text-sm font-semibold text-red-600">{error}</p>}
      </div>
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
