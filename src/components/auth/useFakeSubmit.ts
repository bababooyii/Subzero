"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Mock network round trip: `run(done)` sets `pending` for `ms`, then calls `done`. */
export function useFakeSubmit(ms = 800) {
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const run = useCallback(
    (done: () => void) => {
      if (timer.current) clearTimeout(timer.current);
      setPending(true);
      timer.current = setTimeout(() => {
        setPending(false);
        done();
      }, ms);
    },
    [ms],
  );

  return { pending, run };
}
