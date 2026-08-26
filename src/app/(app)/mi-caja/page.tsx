import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import {
  getStaffMemberCapital,
  getStaffLedger,
} from "@/lib/data/staff-capital";
import { PageHeader } from "@/components/shared/page-header";
import { StaffCashPanel } from "../trabajadores/staff-cash-panel";

export const metadata: Metadata = { title: "Mi caja" };
export const dynamic = "force-dynamic";

/**
 * Vista propia del trabajador: cuánto capital le entregó la empresa, cuánto
 * tiene colocado en préstamos y cuánto efectivo le queda para seguir prestando.
 */
export default async function MyCashPage() {
  const session = await requirePermission("own_capital");
  const [data, ledger] = await Promise.all([
    getStaffMemberCapital(session.sub),
    getStaffLedger(session.sub),
  ]);

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Mi caja" />
        <p className="text-sm text-muted-foreground">
          No se encontró tu usuario.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mi caja"
        description="El efectivo que la empresa te entregó, lo que tienes colocado en préstamos y lo que te queda disponible para seguir prestando."
      />
      <StaffCashPanel data={data} ledger={ledger} showRole={false} />
    </div>
  );
}
