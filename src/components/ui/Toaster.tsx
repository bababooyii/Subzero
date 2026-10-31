"use client";

import { useSyncExternalStore } from "react";
import { UndoNotice } from "@/components/kitchen/UndoNotice";
import { raised } from "@/lib/ui";
import { cn } from "@/helpers/classname-helper";
import { dismiss, getToasts, subscribe } from "./toast";

/** Bottom-centre toast stack. Mounted once in the root layout. Use `toast()` from "./toast" to show one. */
export function Toaster() {
  const toasts = useSyncExternalStore(subscribe, getToasts, getToasts);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-3.5 left-1/2 z-[60] flex w-[min(380px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2">
      {toasts.map((t) =>
        t.onUndo ? (
          <UndoNotice
            key={t.id}
            className="pointer-events-auto animate-rise shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]"
            message={t.message}
            duration={t.duration}
            onExpire={() => dismiss(t.id)}
            onUndo={() => {
              t.onUndo?.();
              dismiss(t.id);
            }}
          />
        ) : (
          <div
            key={t.id}
            role="status"
            className={cn("pointer-events-auto animate-rise rounded-xl px-4 py-2.5 text-[13px] text-text", raised)}
          >
            {t.message}
          </div>
        ),
      )}
    </div>
  );
}
export { toast } from "./toast";
