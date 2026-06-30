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
  "rounded-lg border-2 border-neutral-300 px-4 py-2.5 text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

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
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl w-full flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="oldUrl" className="text-base font-bold text-neutral-900">
          Old site URL
        </label>
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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="newUrl" className="text-base font-bold text-neutral-900">
          New site URL
        </label>
        <input
          id="newUrl"
          type="url"
          required
          placeholder="https://staging.new-site.com (often a staging domain)"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          className={inputClasses}
        />
      </div>

      <details
        className="rounded-lg border-2 border-neutral-200 px-4 py-3"
        open={authOpen}
        onToggle={(e) => setAuthOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer text-base font-bold text-neutral-900">Staging requires login?</summary>
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-sm text-neutral-600">Applied only to the new-site crawl, as HTTP Basic Auth.</p>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputClasses}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClasses}
          />
        </div>
      </details>

      <button
        type="submit"
        disabled={isLoading}
        className="rounded-lg bg-blue-600 px-4 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? "Crawling…" : "Crawl both sites"}
      </button>
    </form>
  );
}
