import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { initials } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const settings = await db.companySettings.findUnique({
    where: { id: "singleton" },
  });
  const company = settings?.companyName ?? "Capital Veci";

  return (
    <div className="app-bg min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4 lg:px-8">
          <Link href="/portal" className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl border border-gold/30 bg-gold/10">
              <span className="font-display text-base font-bold text-gold">V</span>
            </div>
            <div className="leading-tight">
              <p className="font-display text-sm font-semibold">{company}</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Portal del inversionista
              </p>
            </div>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{session.name}</p>
              <p className="text-xs text-muted-foreground">{session.email}</p>
            </div>
            <Avatar className="size-9">
              <AvatarFallback>{initials(session.name)}</AvatarFallback>
            </Avatar>
            <Button asChild variant="ghost" size="icon" aria-label="Salir">
              <a href="/api/auth/logout">
                <LogOut />
              </a>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-10">
        {children}
      </main>
    </div>
  );
}
