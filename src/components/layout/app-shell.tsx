"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { SidebarNav } from "./sidebar";
import { Topbar } from "./topbar";

function Brand({ companyName }: { companyName: string }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3 px-5 py-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/10">
        <span className="font-display text-lg font-bold text-gold">V</span>
      </div>
      <div className="leading-tight">
        <p className="font-display text-base font-semibold">{companyName}</p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Capital privado
        </p>
      </div>
    </Link>
  );
}

export function AppShell({
  user,
  companyName,
  alertCount,
  children,
}: {
  user: { name: string; email: string; role: string };
  companyName: string;
  alertCount: number;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-bg min-h-screen">
      {/* Sidebar fijo — desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-border bg-card/40 backdrop-blur-sm lg:flex">
        <Brand companyName={companyName} />
        <div className="gold-rule mx-5" />
        <SidebarNav role={user.role} />
        <div className="border-t border-border p-4">
          <p className="text-[11px] text-muted-foreground">
            Sesión segura · {user.name}
          </p>
        </div>
      </aside>

      {/* Drawer móvil */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 240 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-border bg-card lg:hidden"
            >
              <div className="flex items-center justify-between pr-3">
                <Brand companyName={companyName} />
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md p-2 text-muted-foreground hover:bg-secondary"
                  aria-label="Cerrar menú"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="gold-rule mx-5" />
              <SidebarNav
                role={user.role}
                onNavigate={() => setMobileOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Contenido */}
      <div className="lg:pl-[264px]">
        <Topbar
          user={user}
          alertCount={alertCount}
          onMenu={() => setMobileOpen(true)}
        />
        <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
