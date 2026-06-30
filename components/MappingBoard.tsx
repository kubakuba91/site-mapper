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

export default function MappingBoard({
  oldPages,
  newPages,
  mappings,
  setMappings,
  onAddOldPage,
  onAddNewPage,
}: Props) {
  const [armedOldPath, setArmedOldPath] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const mappingByOldPath = useMemo(() => {
    const map = new Map<string, Mapping>();
    for (const m of mappings) map.set(m.oldPath, m);
    return map;
  }, [mappings]);

  function updateMapping(oldPath: string, patch: Partial<Mapping>) {
    setMappings((prev) => prev.map((m) => (m.oldPath === oldPath ? { ...m, ...patch } : m)));
  }

  function handleOldRowClick(page: CrawledPage) {
    const mapping = mappingByOldPath.get(page.path);
    if (!mapping) return;

    if (mapping.status === "matched") {
      updateMapping(page.path, { status: "unmatched", newPath: null });
      setArmedOldPath(null);
      return;
    }

    setArmedOldPath((current) => (current === page.path ? null : page.path));
  }

  function handleNewRowClick(page: CrawledPage) {
    if (!armedOldPath) return;
    updateMapping(armedOldPath, { status: "matched", newPath: page.path });
    setArmedOldPath(null);
  }

  function handleMarkDropped(page: CrawledPage) {
    const mapping = mappingByOldPath.get(page.path);
    if (!mapping) return;
    if (mapping.status === "dropped") {
      updateMapping(page.path, { status: "unmatched", newPath: null });
    } else {
      updateMapping(page.path, { status: "dropped", newPath: null });
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
          <span className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-[#8A8F9A]">New site</span>
          <span className="rounded-full border border-[#E4E7EC] bg-white px-2.5 py-0.5 font-mono text-[11px] text-[#5C616C]">
            {newPages.length}
          </span>
        </div>
        {newPages.map((page) => (
          <PageRow key={page.path} page={page} side="new" onClick={() => handleNewRowClick(page)} />
        ))}
        <AddPageRow onAdd={onAddNewPage} />
      </div>

      <ConnectorLayer containerRef={containerRef} mappings={mappings} />
    </div>
  );
}
