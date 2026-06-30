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
      title={label}
      aria-label={label}
      className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-colors disabled:opacity-50 ${
        state === "copied"
          ? "border-green-400 bg-green-50 text-green-700"
          : state === "error"
            ? "border-red-400 bg-red-50 text-red-700"
            : "border-neutral-300 text-neutral-800 hover:bg-neutral-100"
      }`}
    >
      {state === "copied" ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="m8.59 13.51 6.83 3.98" />
          <path d="m15.41 6.51-6.82 3.98" />
        </svg>
      )}
    </button>
  );
}
