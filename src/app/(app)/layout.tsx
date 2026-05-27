import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  const [settings, alertCount] = await Promise.all([
    db.companySettings.findUnique({ where: { id: "singleton" } }),
    db.alert.count({ where: { read: false } }),
  ]);

  return (
    <AppShell
      user={{ name: session.name, email: session.email, role: session.role }}
      companyName={settings?.companyName ?? "Capital Veci"}
      alertCount={alertCount}
    >
      {children}
    </AppShell>
  );
}
