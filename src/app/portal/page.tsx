import type { Metadata } from "next";
import Link from "next/link";
import {
  Wallet,
  TrendingUp,
  FileSignature,
  CalendarClock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  formatCurrency,
  formatPercent,
  formatDate,
  formatRut,
  relativeDays,
} from "@/lib/format";
import {
  CONTRACT_MODALITY_LABELS,
  PAYMENT_TYPE_LABELS,
} from "@/lib/constants";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Portal del inversionista" };
export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const session = await requireSession();

  if (!session.investorId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Acceso pendiente de configuración</CardTitle>
            <CardDescription>
              Tu cuenta aún no está vinculada a un perfil de inversionista.
              Contacta al administrador para finalizar la activación.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const investor = await db.investor.findUnique({
    where: { id: session.investorId },
    include: {
      contracts: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { dueDate: "desc" }, include: { contract: true } },
    },
  });

  if (!investor) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Perfil no encontrado</CardTitle>
          <CardDescription>
            No fue posible cargar tu información de inversionista.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const paid = investor.payments
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + p.amount, 0);
  const upcoming = investor.payments
    .filter((p) => p.status === "PENDING" || p.status === "SCHEDULED")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const overdue = investor.payments.filter((p) => p.status === "OVERDUE");

  const activeContract = investor.contracts.find(
    (c) => c.status === "ACTIVE" || c.status === "SIGNED",
  );

  return (
    <div className="space-y-8">
      {/* Bienvenida */}
      <div className="space-y-1">
        <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">
          Bienvenido(a)
        </p>
        <h1 className="font-display text-3xl font-semibold">
          {investor.fullName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatRut(investor.rut)} · Cliente desde {formatDate(investor.joinDate)}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PortalStat icon={Wallet} label="Capital invertido" value={formatCurrency(investor.investedCapital)} />
        <PortalStat icon={TrendingUp} label="Rentabilidad pactada" value={formatPercent(investor.expectedReturn)} accent="emerald" />
        <PortalStat icon={CheckCircle2} label="Total recibido" value={formatCurrency(paid)} accent="emerald" />
        <PortalStat
          icon={overdue.length > 0 ? AlertCircle : CalendarClock}
          label={overdue.length > 0 ? "Pagos atrasados" : "Próximo pago"}
          value={
            overdue.length > 0
              ? formatCurrency(overdue.reduce((s, p) => s + p.amount, 0))
              : upcoming[0]
                ? formatCurrency(upcoming[0].amount)
                : "—"
          }
          hint={
            overdue.length > 0
              ? `${overdue.length} pago(s)`
              : upcoming[0]
                ? relativeDays(upcoming[0].dueDate)
                : undefined
          }
          accent={overdue.length > 0 ? "danger" : undefined}
        />
      </div>

      {/* Detalle */}
      <Tabs defaultValue="resumen">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="contratos">Contratos</TabsTrigger>
          <TabsTrigger value="pagos">Historial de pagos</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Mi inversión</CardTitle>
                <CardDescription>Detalle de tu participación</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Capital comprometido" value={formatCurrency(investor.investedCapital)} />
                <Row label="Rentabilidad anual" value={formatPercent(investor.expectedReturn)} />
                {activeContract && (
                  <>
                    <Row label="Contrato vigente" value={activeContract.code} />
                    <Row label="Modalidad" value={CONTRACT_MODALITY_LABELS[activeContract.modality] ?? activeContract.modality} />
                    <Row label="Vence" value={formatDate(activeContract.endDate)} />
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Próximos pagos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {upcoming.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">
                        {PAYMENT_TYPE_LABELS[p.type] ?? p.type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(p.dueDate)}
                      </p>
                    </div>
                    <span className="font-medium tabular">
                      {formatCurrency(p.amount)}
                    </span>
                  </div>
                ))}
                {upcoming.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No hay pagos programados.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contratos">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Modalidad</TableHead>
                  <TableHead className="text-right">Rentab.</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {investor.contracts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.code}</TableCell>
                    <TableCell className="text-right tabular">{formatCurrency(c.amount)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {CONTRACT_MODALITY_LABELS[c.modality] ?? c.modality}
                    </TableCell>
                    <TableCell className="text-right tabular">{formatPercent(c.returnRate)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(c.endDate)}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/portal/contratos/${c.id}`}>
                          <FileSignature /> Ver
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {investor.contracts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      Aún no tienes contratos registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="pagos">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {investor.payments.slice(0, 36).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{PAYMENT_TYPE_LABELS[p.type] ?? p.type}</TableCell>
                    <TableCell className="text-right tabular">{formatCurrency(p.amount)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(p.dueDate)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(p.paidDate)}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PortalStat({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  hint?: string;
  accent?: "emerald" | "danger";
}) {
  const color =
    accent === "emerald"
      ? "text-[hsl(var(--success))]"
      : accent === "danger"
        ? "text-[hsl(var(--danger))]"
        : "text-gold";
  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <Icon className={`size-4 ${color}`} />
      </div>
      <p className="font-display text-xl font-semibold tabular">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
