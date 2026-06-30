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
      className="rounded-lg border-2 border-neutral-300 px-5 py-2.5 text-sm font-bold text-neutral-800 transition-colors hover:bg-neutral-100 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
