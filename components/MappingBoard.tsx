"use client";

import { useMemo, useRef, useState, type Dispatch, type SetStateAction, type ReactNode } from "react";
import type { CrawledPage, Mapping } from "@/lib/types";
import PageRow from "./PageRow";
import ConnectorLayer from "./ConnectorLayer";
import ProgressCounter from "./ProgressCounter";
import ExportButton from "./ExportButton";

type Props = {
  oldPages: CrawledPage[];
  newPages: CrawledPage[];
  mappings: Mapping[];
  setMappings: Dispatch<SetStateAction<Mapping[]>>;
  headerExtra?: ReactNode;
};

export default function MappingBoard({ oldPages, newPages, mappings, setMappings, headerExtra }: Props) {
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

  const counts = useMemo(() => {
    let matched = 0;
    let dropped = 0;
    let unmatched = 0;
    for (const m of mappings) {
      if (m.status === "matched") matched++;
      else if (m.status === "dropped") dropped++;
      else unmatched++;
    }
    return { matched, dropped, unmatched };
  }, [mappings]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="sticky top-0 z-10 flex items-center justify-end gap-4 border-b-2 border-neutral-200 bg-white px-4 py-4">
        <ProgressCounter
          matched={counts.matched}
          dropped={counts.dropped}
          unmatched={counts.unmatched}
          total={oldPages.length}
        />
        <div className="flex items-center gap-2">
          {headerExtra}
          <ExportButton oldPages={oldPages} mappings={mappings} />
        </div>
      </div>

      <div ref={containerRef} className="relative flex-1 grid grid-cols-2 gap-12 px-4 pb-8 overflow-hidden">
        <div data-scroll-column className="flex flex-col gap-2 overflow-y-auto">
          <h2 className="sticky top-0 bg-white py-2 text-sm font-bold uppercase tracking-wide text-neutral-700">
            Old site ({oldPages.length})
          </h2>
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
        </div>

        <div data-scroll-column className="flex flex-col gap-2 overflow-y-auto">
          <h2 className="sticky top-0 bg-white py-2 text-sm font-bold uppercase tracking-wide text-neutral-700">
            New site ({newPages.length})
          </h2>
          {newPages.map((page) => (
            <PageRow key={page.path} page={page} side="new" onClick={() => handleNewRowClick(page)} />
          ))}
        </div>

        <ConnectorLayer containerRef={containerRef} mappings={mappings} />
      </div>
    </div>
  );
}
