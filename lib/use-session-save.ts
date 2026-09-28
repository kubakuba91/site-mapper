"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  saveSession,
  type SessionAccess,
  type SessionSnapshot,
} from "./sessions";

// One writer per tab; the database revision check protects against other tabs.
export function useSessionSave(snapshot: SessionSnapshot | null) {
  const access = useRef<SessionAccess | null>(null);
  const latest = useRef<SessionSnapshot | null>(null);
  const saved = useRef<string>("");
  const pending = useRef<Promise<void> | null>(null);
  const failure = useRef<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState("Not shared");
  const [saveError, setSaveError] = useState<string | null>(null);

  const flush = useCallback(async () => {
    if (pending.current) return pending.current;
    if (failure.current) throw new Error(failure.current);
    const session = access.current;
    if (!session) return;
    const work = async () => {
      while (
        access.current === session &&
        latest.current &&
        JSON.stringify(latest.current) !== saved.current
      ) {
        const next = latest.current;
        const serialized = JSON.stringify(next);
        setSaveStatus("Saving…");
        try {
          session.revision = await saveSession(session, next);
          saved.current = serialized;
          setSaveStatus("Saved");
        } catch (err) {
          failure.current = err instanceof Error ? err.message : "Save failed";
          setSaveError(failure.current);
          setSaveStatus("Not saved — export your work before reloading");
          throw err;
        }
      }
    };
    pending.current = work().finally(() => {
      pending.current = null;
    });
    return pending.current;
  }, []);

  const activate = useCallback(
    (next: SessionAccess, baseline: SessionSnapshot) => {
      access.current = next;
      saved.current = JSON.stringify(baseline);
      failure.current = null;
      setSaveError(null);
      setSessionId(next.id);
      setSaveStatus("Saved");
    },
    [],
  );
  const clear = useCallback(() => {
    access.current = null;
    saved.current = "";
    failure.current = null;
    setSessionId(null);
    setSaveError(null);
    setSaveStatus("Not shared");
  }, []);

  useEffect(() => {
    latest.current = snapshot;
    if (access.current && snapshot)
      void flush().catch(() => {
        /* visible saveError */
      });
  }, [snapshot, sessionId, flush]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (
        access.current &&
        latest.current &&
        JSON.stringify(latest.current) !== saved.current
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  return { sessionId, saveStatus, saveError, flush, activate, clear };
}
