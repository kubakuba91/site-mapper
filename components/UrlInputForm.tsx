"use client";

import { useState } from "react";
import type { BasicAuth } from "@/lib/types";

export type SubmitPayload = {
  oldUrl: string;
  newUrl: string;
  newSiteAuth?: BasicAuth;
};

type Props = {
  onSubmit: (payload: SubmitPayload) => void;
  isLoading: boolean;
};

const inputClasses =
  "w-full rounded-[10px] border border-[#E2E5EA] bg-white px-3.5 py-3 font-mono text-sm text-[#14161A] outline-none transition-shadow placeholder:text-[#A4A9B4] focus:border-blue-600 focus:ring-[3px] focus:ring-blue-600/10";

export default function UrlInputForm({ onSubmit, isLoading }: Props) {
  const [oldUrl, setOldUrl] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!oldUrl.trim() || !newUrl.trim()) return;
    const newSiteAuth = username || password ? { username, password } : undefined;
    onSubmit({ oldUrl: oldUrl.trim(), newUrl: newUrl.trim(), newSiteAuth });
  }

  return (
    <div className="w-full rounded-[18px] border border-[#E4E7EC] bg-white p-7 shadow-[0_1px_2px_rgba(16,18,22,0.04),0_20px_48px_-24px_rgba(16,18,22,0.18)]">
      <div className="mb-6 flex items-center justify-between border-b border-[#F0F1F4] pb-4.5">
        <span className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-[#8A8F9A]">
          New mapping
        </span>
        <span className="flex items-center gap-1.5 font-mono text-xs text-[#5C616C]">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isLoading ? "bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.16)]" : "bg-[#1FAE6B] shadow-[0_0_0_3px_rgba(31,174,107,0.16)]"
            }`}
          />
          {isLoading ? "crawling" : "ready"}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <label htmlFor="oldUrl" className="text-sm font-semibold text-[#14161A]">
              Old site URL
            </label>
            <span className="font-mono text-xs text-[#A4A9B4]">currently live</span>
          </div>
          <input
            id="oldUrl"
            type="url"
            required
            placeholder="https://old-site.com"
            value={oldUrl}
            onChange={(e) => setOldUrl(e.target.value)}
            className={inputClasses}
          />
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <label htmlFor="newUrl" className="text-sm font-semibold text-[#14161A]">
              New site URL
            </label>
            <span className="font-mono text-xs text-[#A4A9B4]">staging or prod</span>
          </div>
          <input
            id="newUrl"
            type="url"
            required
            placeholder="https://staging.new-site.com"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className={inputClasses}
          />
        </div>

        <button
          type="button"
          onClick={() => setAuthOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-[10px] border border-[#E8EAEE] bg-[#FAFBFC] px-3.5 py-3 text-left text-sm font-semibold text-[#14161A] transition-colors hover:bg-[#F4F5F7]"
        >
          <span>Staging requires login?</span>
          <span
            className="font-mono text-[#8A8F9A] transition-transform duration-200"
            style={{ transform: authOpen ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            ›
          </span>
        </button>

        {authOpen && (
          <div className="-mt-2 rounded-[10px] border border-dashed border-[#E2E5EA] bg-[#FBFBFC] p-4">
            <p className="mb-3.5 font-mono text-xs leading-relaxed text-[#8A8F9A]">
              HTTP basic-auth credentials for the staging domain.
            </p>
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`flex-1 basis-[140px] ${inputClasses} py-2.5`}
              />
              <input
                type="password"
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`flex-1 basis-[140px] ${inputClasses} py-2.5`}
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-[11px] bg-blue-600 py-3.5 text-base font-semibold text-white shadow-[0_8px_20px_-8px_rgba(37,99,235,0.4)] transition-[filter,transform] hover:brightness-95 active:translate-y-px disabled:opacity-50"
        >
          {isLoading ? "Crawling…" : "Crawl both sites"}
          <span className="font-mono font-medium">→</span>
        </button>

        <p className="mt-1 text-center font-mono text-xs leading-relaxed text-[#A4A9B4]">
          Outputs a CSV of 301 redirects — ready for Nginx, Apache or Vercel.
        </p>
      </form>
    </div>
  );
}
