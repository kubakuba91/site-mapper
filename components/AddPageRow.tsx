"use client";

import { useState } from "react";

type Props = {
  onAdd: (path: string) => void;
};

export default function AddPageRow({ onAdd }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    try {
      onAdd(trimmed);
      setValue("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid page path");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border-2 border-dashed border-neutral-300 px-4 py-3 text-sm font-bold text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-700"
      >
        + Add page manually
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
      <input
        aria-label="Page path"
        type="text"
        autoFocus
        placeholder="/path/to/page"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setValue("");
          }
        }}
        className="min-w-0 flex-1 rounded-lg border-2 border-neutral-300 px-3 py-2 font-mono text-sm text-neutral-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      />
      <button
        type="submit"
        className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-bold text-white hover:bg-neutral-700"
      >
        Add
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setValue("");
        }}
        className="rounded-lg border-2 border-neutral-300 px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-100"
      >
        Cancel
      </button>
      {error && (
        <p role="alert" className="w-full text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
