"use client";

import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { CrawledPage, Mapping } from "@/lib/types";
import PageRow from "./PageRow";
import ConnectorLayer from "./ConnectorLayer";
import AddPageRow from "./AddPageRow";

type Props = {
  oldPages: CrawledPage[];
  newPages: CrawledPage[];
  mappings: Mapping[];
  setMappings: Dispatch<SetStateAction<Mapping[]>>;
  onAddOldPage: (path: string) => void;
  onAddNewPage: (path: string) => void;
};

type RankedNewPage = {
  page: CrawledPage;
  confidence: number;
};

export default function MappingBoard({
  oldPages,
  newPages,
  mappings,
  setMappings,
  onAddOldPage,
  onAddNewPage,
}: Props) {
  const [armedOldPath, setArmedOldPath] = useState<string | null>(null);
  const [showAllNewPages, setShowAllNewPages] = useState(false);
  const [newPageSearch, setNewPageSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const mappingByOldPath = useMemo(() => {
    const map = new Map<string, Mapping>();
    for (const m of mappings) map.set(m.oldPath, m);
    return map;
  }, [mappings]);

  const oldPageByPath = useMemo(() => {
    const map = new Map<string, CrawledPage>();
    for (const page of oldPages) map.set(page.path, page);
    return map;
  }, [oldPages]);

  const oldPathsByNewPath = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const mapping of mappings) {
      if (mapping.status !== "matched" || !mapping.newPath) continue;
      const oldPaths = map.get(mapping.newPath) ?? [];
      oldPaths.push(mapping.oldPath);
      map.set(mapping.newPath, oldPaths);
    }
    return map;
  }, [mappings]);

  const armedOldPage = armedOldPath ? oldPageByPath.get(armedOldPath) : null;

  const rankedNewPages = useMemo(() => {
    if (!armedOldPage) return [];
    return newPages
      .map((page) => ({ page, confidence: scorePageMatch(armedOldPage, page) }))
      .filter((match) => match.confidence >= 35)
      .sort((a, b) => b.confidence - a.confidence || a.page.path.localeCompare(b.page.path));
  }, [armedOldPage, newPages]);

  const displayedNewPages: RankedNewPage[] =
    armedOldPage && !showAllNewPages
      ? rankedNewPages
      : newPages.map((page) => ({ page, confidence: 0 }));

  const filteredNewPages = useMemo(() => {
    const query = newPageSearch.trim().toLowerCase();
    if (!query) return displayedNewPages;

    return displayedNewPages.filter(({ page }) =>
      [page.path, page.url, page.title, page.description].some((value) => value?.toLowerCase().includes(query)),
    );
  }, [displayedNewPages, newPageSearch]);

  function updateMapping(oldPath: string, patch: Partial<Mapping>) {
    setMappings((prev) => prev.map((m) => (m.oldPath === oldPath ? { ...m, ...patch } : m)));
  }

  function metadataPatchForOldPath(oldPath: string): Partial<Mapping> {
    const oldPage = oldPageByPath.get(oldPath);
    return {
      metadataTitle: oldPage?.title ?? null,
      metadataDescription: oldPage?.description ?? null,
    };
  }

  function handleOldRowClick(page: CrawledPage) {
    const mapping = mappingByOldPath.get(page.path);
    if (!mapping) return;

    if (mapping.status === "matched") {
      updateMapping(page.path, { status: "unmatched", newPath: null, metadataTitle: null, metadataDescription: null });
      setArmedOldPath(null);
      setShowAllNewPages(false);
      return;
    }

    setArmedOldPath((current) => {
      const next = current === page.path ? null : page.path;
      setShowAllNewPages(false);
      return next;
    });
  }

  function handleNewRowClick(page: CrawledPage) {
    if (!armedOldPath) return;
    updateMapping(armedOldPath, { status: "matched", newPath: page.path, ...metadataPatchForOldPath(armedOldPath) });
    setArmedOldPath(null);
    setShowAllNewPages(false);
  }

  function handleRemoveMappedOldPath(oldPath: string) {
    updateMapping(oldPath, { status: "unmatched", newPath: null, metadataTitle: null, metadataDescription: null });
    if (armedOldPath === oldPath) setArmedOldPath(null);
  }

  function handleMarkDropped(page: CrawledPage) {
    const mapping = mappingByOldPath.get(page.path);
    if (!mapping) return;
    if (mapping.status === "dropped") {
      updateMapping(page.path, { status: "unmatched", newPath: null, metadataTitle: null, metadataDescription: null });
    } else {
      updateMapping(page.path, { status: "dropped", newPath: null, metadataTitle: null, metadataDescription: null });
    }
    if (armedOldPath === page.path) setArmedOldPath(null);
  }

  return (
    <div ref={containerRef} className="relative isolate flex h-full gap-9 overflow-hidden px-8 pb-8">
      <div data-scroll-column className="relative z-10 flex flex-1 flex-col gap-2.5 overflow-y-auto">
        <div className="sticky top-0 z-10 mb-1 flex items-center gap-2 bg-white py-2">
          <span className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-[#8A8F9A]">Old site</span>
          <span className="rounded-full border border-[#E4E7EC] bg-white px-2.5 py-0.5 font-mono text-[11px] text-[#5C616C]">
            {oldPages.length}
          </span>
        </div>
        {oldPages.map((page) => {
          const mapping = mappingByOldPath.get(page.path);
          return (
            <PageRow
              key={page.path}
              page={page}
              side="old"
              status={mapping?.status}
              armed={armedOldPath === page.path}
              onClick={() => handleOldRowClick(page)}
              onMarkDropped={() => handleMarkDropped(page)}
            />
          );
        })}
        <AddPageRow onAdd={onAddOldPage} />
      </div>

      <div data-scroll-column className="relative z-10 flex flex-1 flex-col gap-2.5 overflow-y-auto">
        <div className="sticky top-0 z-10 mb-1 flex items-center gap-2 bg-white py-2">
          <span className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-[#8A8F9A]">
            {armedOldPage && !showAllNewPages ? "Suggested matches" : "New site"}
          </span>
          <span className="rounded-full border border-[#E4E7EC] bg-white px-2.5 py-0.5 font-mono text-[11px] text-[#5C616C]">
            {filteredNewPages.length}
          </span>
          {armedOldPage && (
            <button
              type="button"
              onClick={() => setShowAllNewPages((current) => !current)}
              className="ml-auto rounded-md border border-[#E2E5EA] bg-white px-2.5 py-1 font-mono text-[11px] font-medium text-blue-600 hover:bg-[#F7F8FA]"
            >
              {showAllNewPages ? "Show Suggestions" : "Show All Pages"}
            </button>
          )}
        </div>
        <div className="sticky top-[45px] z-10 bg-white pb-2">
          <input
            type="search"
            value={newPageSearch}
            onChange={(event) => setNewPageSearch(event.target.value)}
            placeholder="Search new pages..."
            aria-label="Search new-site pages"
            className="h-9 w-full rounded-lg border border-[#DDE1E7] bg-white px-3 font-mono text-[12px] text-[#14161A] outline-none transition placeholder:text-[#A4A9B4] focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        {filteredNewPages.map(({ page, confidence }) => (
          <PageRow
            key={page.path}
            page={page}
            side="new"
            matchConfidence={armedOldPage && !showAllNewPages ? confidence : undefined}
            mappedOldPaths={oldPathsByNewPath.get(page.path) ?? []}
            onRemoveMappedOldPath={handleRemoveMappedOldPath}
            onClick={() => handleNewRowClick(page)}
          />
        ))}
        <AddPageRow onAdd={onAddNewPage} />
      </div>

      <ConnectorLayer containerRef={containerRef} mappings={mappings} />
    </div>
  );
}

function scorePageMatch(oldPage: CrawledPage, newPage: CrawledPage): number {
  const oldPath = normalizePathForScoring(oldPage.path);
  const newPath = normalizePathForScoring(newPage.path);
  if (oldPath === newPath) return 98;

  const oldSegments = pathSegments(oldPath);
  const newSegments = pathSegments(newPath);
  const oldSlug = oldSegments.at(-1) ?? "";
  const newSlug = newSegments.at(-1) ?? "";

  if (oldSegments.length >= 3 && newSegments.length >= 3 && tail(oldSegments, 3) === tail(newSegments, 3)) return 92;
  if (oldSegments.length >= 2 && newSegments.length >= 2 && tail(oldSegments, 2) === tail(newSegments, 2)) return 82;
  if (oldSlug && oldSlug === newSlug) return 74;

  const pathScore = overlapScore(tokensFromText(oldPath), tokensFromText(newPath), 68);
  const titleScore = overlapScore(tokensFromText(oldPage.title), tokensFromText(newPage.title), 58);
  const descriptionScore = overlapScore(tokensFromText(oldPage.description), tokensFromText(newPage.description), 46);

  return Math.round(Math.max(pathScore, titleScore, descriptionScore));
}

function normalizePathForScoring(path: string): string {
  const pathOnly = path.split("?")[0].split("#")[0];
  const withSlash = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
  return withSlash.length > 1 && withSlash.endsWith("/") ? withSlash.slice(0, -1).toLowerCase() : withSlash.toLowerCase();
}

function pathSegments(path: string): string[] {
  return path.split("/").filter(Boolean);
}

function tail(segments: string[], count: number): string {
  return segments.slice(-count).join("/");
}

function tokensFromText(value: string | null): string[] {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 2),
    ),
  );
}

function overlapScore(oldTokens: string[], newTokens: string[], maxScore: number): number {
  if (oldTokens.length === 0 || newTokens.length === 0) return 0;
  const newTokenSet = new Set(newTokens);
  const overlap = oldTokens.filter((token) => newTokenSet.has(token)).length;
  return (overlap / Math.max(oldTokens.length, 1)) * maxScore;
}
