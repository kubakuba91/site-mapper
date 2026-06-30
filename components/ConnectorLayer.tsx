"use client";

import { useEffect, useState, type RefObject } from "react";
import type { Mapping } from "@/lib/types";

type Line = { id: string; x1: number; y1: number; x2: number; y2: number };

type Props = {
  containerRef: RefObject<HTMLDivElement | null>;
  mappings: Mapping[];
};

export default function ConnectorLayer({ containerRef, mappings }: Props) {
  const [lines, setLines] = useState<Line[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function recalculate() {
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      setSize({ width: container.scrollWidth, height: container.scrollHeight });

      const nextLines: Line[] = [];
      for (const mapping of mappings) {
        if (mapping.status !== "matched" || !mapping.newPath) continue;
        const oldEl = container.querySelector<HTMLElement>(`[data-row-id="old:${attrEscape(mapping.oldPath)}"]`);
        const newEl = container.querySelector<HTMLElement>(`[data-row-id="new:${attrEscape(mapping.newPath)}"]`);
        if (!oldEl || !newEl) continue;

        const oldRect = oldEl.getBoundingClientRect();
        const newRect = newEl.getBoundingClientRect();

        nextLines.push({
          id: `${mapping.oldPath}->${mapping.newPath}`,
          x1: oldRect.right - containerRect.left + container.scrollLeft,
          y1: oldRect.top + oldRect.height / 2 - containerRect.top + container.scrollTop,
          x2: newRect.left - containerRect.left + container.scrollLeft,
          y2: newRect.top + newRect.height / 2 - containerRect.top + container.scrollTop,
        });
      }
      setLines(nextLines);
    }

    recalculate();

    const resizeObserver = new ResizeObserver(recalculate);
    resizeObserver.observe(container);

    container.addEventListener("scroll", recalculate, { passive: true });
    window.addEventListener("resize", recalculate);

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener("scroll", recalculate);
      window.removeEventListener("resize", recalculate);
    };
  }, [containerRef, mappings]);

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0"
      width={size.width}
      height={size.height}
      style={{ overflow: "visible" }}
    >
      {lines.map((line) => (
        <path
          key={line.id}
          d={`M ${line.x1} ${line.y1} C ${(line.x1 + line.x2) / 2} ${line.y1}, ${(line.x1 + line.x2) / 2} ${line.y2}, ${line.x2} ${line.y2}`}
          stroke="#3b82f6"
          strokeWidth={1.5}
          fill="none"
          opacity={0.7}
        />
      ))}
    </svg>
  );
}

function attrEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}
