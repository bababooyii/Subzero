"use client";

import { Command } from "cmdk";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/helpers/classname-helper";
import { heroBody, heroFrame, raised } from "@/lib/ui";
import type { NavIcon } from "./icons";
import type { NavItem } from "./nav";

const item =
  "flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-muted outline-none data-[selected=true]:bg-white/5 data-[selected=true]:text-text [&_svg]:size-4 [&_svg]:shrink-0";
const heading = "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted/70";

/** A searchable group of records. `lead` is the bold id, `label` the name, `trail` a right-aligned detail. */
export type PaletteGroup = {
  heading: string;
  icon: NavIcon;
  items: { id: string; href: string; value: string; lead?: string; label: string; trail?: string }[];
};

type Props = {
  pages: NavItem[];
  /** Always-visible record groups. */
  groups?: PaletteGroup[];
  /** Record search, called (debounced) as the user types. Its groups show under the pages. */
  search?: (q: string) => Promise<PaletteGroup[]>;
  placeholder?: string;
};

const SEARCH_DEBOUNCE_MS = 200;

/** ⌘K trigger button plus the cmdk palette: jump to any page or record. The shells decide what is searchable. */
export function CommandPalette({ pages, groups = [], search, placeholder = "Jump to a page, subscription or customer" }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("flex h-9 cursor-pointer items-center gap-2 rounded-full pr-2 pl-3.5 text-[13px] text-muted outline-none hover:bg-[#242424] hover:text-text focus-visible:outline-2 focus-visible:outline-accent", raised)}
        aria-label="Open command palette"
      >
        <Search size={14} strokeWidth={2.5} aria-hidden="true" />
        <span className="max-sm:hidden">Search</span>
        <kbd className="ml-2 rounded-full bg-white/10 px-1.5 text-[10px] leading-[16px] font-medium text-muted max-sm:hidden">⌘K</kbd>
      </button>

      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Command palette"
        overlayClassName="fixed inset-0 z-50 animate-fade-in bg-black/90 backdrop-blur-[12px]"
        contentClassName="fixed top-[18vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-[520px] -translate-x-1/2 animate-fade-in outline-none"
      >
        <PaletteBody pages={pages} groups={groups} search={search} placeholder={placeholder} go={go} />
      </Command.Dialog>
    </>
  );
}

type BodyProps = Pick<Props, "pages" | "search" | "placeholder"> & { groups: PaletteGroup[]; go: (href: string) => void };

/** The dialog's content. It unmounts when the palette closes, so the query and results reset by themselves. */
function PaletteBody({ pages, groups, search, placeholder, go }: BodyProps) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<PaletteGroup[]>([]);
  const latest = useRef(0);
  const term = query.trim();

  useEffect(() => {
    if (!search || !term) return;
    const id = ++latest.current;
    const timer = setTimeout(() => {
      search(term).then(
        (res) => {
          if (id === latest.current) setFound(res);
        },
        () => {
          if (id === latest.current) setFound([]);
        },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, search]);

  const onQuery = (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      latest.current++;
      setFound([]);
    }
  };

  return (
    <>
        <div className={heroFrame}>
  <div className={cn(heroBody, "overflow-hidden")}>
    <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4">
      <Search size={15} className="shrink-0 text-muted" aria-hidden="true" />
      <Command.Input
        placeholder={placeholder}
        value={query}
        onValueChange={onQuery}
        className="h-12 w-full bg-transparent text-[13px] text-text outline-none placeholder:text-muted"
      />
    </div>
    <Command.List className={cn("max-h-[360px] overflow-y-auto p-1.5", heading)}>
      <Command.Empty className="px-3 py-8 text-center text-[13px] text-muted">Nothing found.</Command.Empty>
      <Command.Group heading="Pages">
        {pages.map((p) => (
          <Command.Item key={p.href} value={`page ${p.label}`} className={item} onSelect={() => go(p.href)}>
            <p.icon size={16} />
            {p.label}
          </Command.Item>
        ))}
      </Command.Group>
      {[...groups, ...found].map((g) => (
        <Command.Group key={g.heading} heading={g.heading}>
          {g.items.map((it) => (
            // The query rides along in `value` so cmdk's own filter never hides a server hit (it may match on the email or customer instead).
            <Command.Item key={it.id} value={`${query} ${it.value} ${it.id}`} className={item} onSelect={() => go(it.href)}>
              <g.icon size={16} />
              {it.lead ? <span className="text-text tabular-nums">{it.lead}</span> : null}
              <span className={cn("truncate", !it.lead && "text-text")}>{it.label}</span>
              {it.trail ? <span className="ml-auto text-[12px]">{it.trail}</span> : null}
            </Command.Item>
          ))}
        </Command.Group>
      ))}
    </Command.List>
  </div>
</div>
    </>
  );
}
