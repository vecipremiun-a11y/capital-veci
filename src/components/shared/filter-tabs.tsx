"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export interface FilterTab {
  label: string;
  value: string | null; // null = sin filtro (todos)
  count?: number;
}

export function FilterTabs({
  param = "estado",
  tabs,
}: {
  param?: string;
  tabs: FilterTab[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(param);

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card/40 p-1">
      {tabs.map((tab) => {
        const active = (tab.value ?? null) === (current ?? null);
        const href = tab.value
          ? `${pathname}?${param}=${tab.value}`
          : pathname;
        return (
          <Link
            key={tab.label}
            href={href}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-gold/15 text-gold"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {tab.label}
            {typeof tab.count === "number" && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular",
                  active ? "bg-gold/20" : "bg-muted",
                )}
              >
                {tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
