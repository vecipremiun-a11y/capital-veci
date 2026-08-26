import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import {
  getStaffMemberCapital,
  getStaffCapital,
  getStaffLedger,
} from "@/lib/data/staff-capital";
import { ROLE_LABELS } from "@/lib/constants";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { AssignCapitalDialog } from "../assign-capital-dialog";
import { StaffCashPanel } from "../staff-cash-panel";

export const metadata: Metadata = { title: "Caja del trabajador" };
export const dynamic = "force-dynamic";

export default async function StaffMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("staff_capital");
  const { id } = await params;

  const [data, staff, ledger] = await Promise.all([
    getStaffMemberCapital(id),
    getStaffCapital(),
    getStaffLedger(id),
  ]);
  if (!data) notFound();

  const options = staff.map((s) => ({
    id: s.userId,
    name: s.name,
    role: s.role,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.capital.name}
        description={`${ROLE_LABELS[data.capital.role] ?? data.capital.role} · ${data.capital.email}`}
      >
        <Button asChild variant="outline">
          <Link href="/trabajadores">
            <ArrowLeft /> Volver
          </Link>
        </Button>
        <AssignCapitalDialog staff={options} preselected={id} />
      </PageHeader>

      <StaffCashPanel data={data} ledger={ledger} canDelete />
    </div>
  );
}
