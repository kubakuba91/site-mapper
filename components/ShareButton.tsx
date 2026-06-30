"use client";

import { useState } from "react";

type Props = {
  onShare: () => Promise<string>;
};

export default function ShareButton({ onShare }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error">("idle");

  async function handleClick() {
    setState("loading");
    try {
      const url = await onShare();
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  }

  const label = {
    idle: "Share link",
    loading: "Saving…",
    copied: "Link copied!",
    error: "Failed to share",
  }[state];

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === "loading"}
      className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
