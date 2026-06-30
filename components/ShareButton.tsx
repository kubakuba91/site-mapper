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
    idle: "Share",
    loading: "Saving…",
    copied: "Link copied!",
    error: "Failed to share",
  }[state];

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === "loading"}
      className={`inline-flex items-center gap-2 rounded-[10px] border px-3.5 py-2 font-sans text-[13px] font-medium transition-colors disabled:opacity-50 ${
        state === "copied"
          ? "border-green-300 bg-green-50 text-green-700"
          : state === "error"
            ? "border-red-300 bg-red-50 text-red-700"
            : "border-[#E2E5EA] bg-white text-[#14161A] hover:bg-[#F7F8FA]"
      }`}
    >
      {state === "copied" ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="m8.59 13.51 6.83 3.98" />
          <path d="m15.41 6.51-6.82 3.98" />
        </svg>
      )}
      {label}
    </button>
  );
}
