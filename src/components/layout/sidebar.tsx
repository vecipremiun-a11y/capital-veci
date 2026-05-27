"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { NAV_SECTIONS } from "@/lib/nav";
import { ROLE_PERMISSIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string): boolean {
  const base = href.split("?")[0];
  if (base === "/dashboard") return pathname === "/dashboard";
  return pathname === base || pathname.startsWith(base + "/");
}

export function SidebarNav({
  role,
  onNavigate,
}: {
  role: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const current = search ? `${pathname}?${search}` : pathname;
  const permissions = ROLE_PERMISSIONS[role] ?? [];

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {NAV_SECTIONS.map((section) => {
        const items = section.items.filter((i) =>
          permissions.includes(i.permission),
        );
        if (items.length === 0) return null;
        return (
          <div key={section.title}>
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
              {section.title}
            </p>
            <ul className="space-y-1">
              {items.map((item) => (
                <NavEntry
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  current={current}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function NavEntry({
  item,
  pathname,
  current,
  onNavigate,
}: {
  item: (typeof NAV_SECTIONS)[number]["items"][number];
  pathname: string;
  current: string;
  onNavigate?: () => void;
}) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  const [open, setOpen] = useState(active);
  const hasChildren = item.children && item.children.length > 0;

  return (
    <li>
      <div className="relative">
        {active && (
          <motion.span
            layoutId="nav-active"
            className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-gold"
          />
        )}
        <Link
          href={item.href}
          onClick={() => {
            if (hasChildren) setOpen((o) => !o);
            onNavigate?.();
          }}
          className={cn(
            "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            active
              ? "bg-gold/10 text-foreground"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          )}
        >
          <Icon
            className={cn(
              "size-[18px] shrink-0 transition-colors",
              active ? "text-gold" : "text-muted-foreground group-hover:text-foreground",
            )}
          />
          <span className="flex-1">{item.label}</span>
          {hasChildren && (
            <ChevronRight
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                open && "rotate-90",
              )}
              onClick={(e) => {
                e.preventDefault();
                setOpen((o) => !o);
              }}
            />
          )}
        </Link>
      </div>

      {hasChildren && (
        <AnimatePresence initial={false}>
          {open && (
            <motion.ul
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="ml-[26px] mt-1 space-y-0.5 overflow-hidden border-l border-border pl-3"
            >
              {item.children!.map((child) => {
                const childActive = child.href.includes("?")
                  ? current === child.href
                  : current === child.href ||
                    (pathname === child.href.split("?")[0] &&
                      child.href === item.href &&
                      !current.includes("?"));
                return (
                  <li key={child.href}>
                    <Link
                      href={child.href}
                      onClick={onNavigate}
                      className={cn(
                        "block rounded-md px-3 py-1.5 text-[13px] transition-colors",
                        childActive
                          ? "text-gold"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {child.label}
                    </Link>
                  </li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      )}
    </li>
  );
}
