export type ToastItem = {
  id: number;
  message: string;
  duration: number;
  onUndo?: () => void;
};

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

const emit = () => listeners.forEach((l) => l());

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export const getToasts = () => items;

export function dismiss(id: number) {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.delete(id);
  items = items.filter((i) => i.id !== id);
  emit();
}

function push(message: string, duration: number, onUndo?: () => void) {
  const id = nextId++;
  // One toast at a time: a new one replaces the old so they never stack up over the page.
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  items = [{ id, message, duration, onUndo }];
  // Undo toasts expire through UndoNotice's own timer; plain ones here.
  if (!onUndo) timers.set(id, setTimeout(() => dismiss(id), duration));
  emit();
  return id;
}

/** Plain toast. */
export function toast(message: string, duration = 1500) {
  return push(message, duration);
}

/** Toast with an Undo action for reversible status changes. No undo for permanent deletes. */
toast.undo = (message: string, onUndo: () => void, duration = 3000) => push(message, duration, onUndo);
toast.dismiss = dismiss;
