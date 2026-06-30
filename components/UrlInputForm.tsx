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
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl w-full flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <label htmlFor="oldUrl" className="text-sm font-medium text-neutral-700">
          Old site URL
        </label>
        <input
          id="oldUrl"
          type="url"
          required
          placeholder="https://old-site.com"
          value={oldUrl}
          onChange={(e) => setOldUrl(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="newUrl" className="text-sm font-medium text-neutral-700">
          New site URL
        </label>
        <input
          id="newUrl"
          type="url"
          required
          placeholder="https://staging.new-site.com (often a staging domain)"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <details
        className="rounded-md border border-neutral-200 px-3 py-2"
        open={authOpen}
        onToggle={(e) => setAuthOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer text-sm font-medium text-neutral-700">
          Staging requires login?
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-xs text-neutral-500">
            Applied only to the new-site crawl, as HTTP Basic Auth.
          </p>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </details>

      <button
        type="submit"
        disabled={isLoading}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? "Crawling…" : "Crawl both sites"}
      </button>
    </form>
  );
}
