"use client";

import { useCallback, useState } from "react";

/** Tracks an in-flight async submit: `run(fn)` sets `pending` until `fn` settles. */
export function usePending() {
  const [pending, setPending] = useState(false);
  const run = useCallback(async (fn: () => Promise<void>) => {
    setPending(true);
    try {
      await fn();
    } finally {
      setPending(false);
    }
  }, []);
  return { pending, run };
}
