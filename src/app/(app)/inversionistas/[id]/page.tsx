import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  Mail,
  Phone,
  FileSignature,
  Wallet,
  TrendingUp,
  CalendarClock,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { db } from "@/lib/db";
import {
  formatCurrency,
  formatPercent,
  formatDate,
  formatRut,
  initials,
} from "@/lib/format";
import {
  PAYMENT_TYPE_LABELS,
  CONTRACT_MODALITY_LABELS,
} from "@/lib/constants";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge, RiskBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvestorAccessDialog } from "./investor-access-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Perfil de inversionista" };
export const dynamic = "force-dynamic";

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: any;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card/50 p-4">
      <div className="flex size-10 items-center justify-center rounded-lg bg-gold/10 text-gold">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-display text-lg font-semibold tabular">{value}</p>
      </div>
    </div>
  );
}

export default async function InvestorProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const investor = await db.investor.findUnique({
    where: { id },
    include: {
      contracts: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { dueDate: "desc" }, include: { contract: true } },
      documents: { orderBy: { uploadedAt: "desc" } },
      user: true,
    },
  });

  if (!investor) notFound();

  const paid = investor.payments
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + p.amount, 0);
  const pending = investor.payments
    .filter((p) => p.status === "PENDING" || p.status === "SCHEDULED")
    .reduce((s, p) => s + p.amount, 0);
  const overdue = investor.payments
    .filter((p) => p.status === "OVERDUE")
    .reduce((s, p) => s + p.amount, 0);
  const activeContract = investor.contracts.find(
    (c) => c.status === "ACTIVE" || c.status === "SIGNED",
  );

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
        <Link href="/inversionistas">
          <ArrowLeft /> Volver a inversionistas
        </Link>
      </Button>

      {/* Encabezado del perfil */}
      <Card className="overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-gold/15 via-gold/5 to-transparent" />
        <CardContent className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <Avatar className="size-20 border-4 border-card">
              <AvatarFallback className="text-xl">
                {initials(investor.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="pb-1">
              <h1 className="font-display text-2xl font-semibold">
                {investor.fullName}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="tabular">{formatRut(investor.rut)}</span>
                {investor.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="size-3.5" /> {investor.email}
                  </span>
                )}
                {investor.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="size-3.5" /> {investor.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pb-1">
            <RiskBadge level={investor.riskLevel} />
            <StatusBadge status={investor.status} />
            {investor.user ? (
              <Badge
                variant="muted"
                className="flex items-center gap-1.5 border-emerald/40 bg-emerald/10 text-emerald"
              >
                <ShieldCheck className="size-3.5" />
                Acceso al portal · {investor.user.email}
              </Badge>
            ) : (
              <InvestorAccessDialog
                investorId={investor.id}
                investorName={investor.fullName}
                defaultEmail={investor.email}
              />
            )}
            <Button asChild variant="gold" size="sm">
              <Link href={`/contratos/nuevo?investor=${investor.id}`}>
                <FileSignature /> Nuevo contrato
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Capital invertido" value={formatCurrency(investor.investedCapital)} icon={Wallet} />
        <Stat label="Rentabilidad pactada" value={formatPercent(investor.expectedReturn)} icon={TrendingUp} />
        <Stat label="Pagos recibidos" value={formatCurrency(paid)} icon={Wallet} />
        <Stat
          label={overdue > 0 ? "Pagos vencidos" : "Pagos pendientes"}
          value={formatCurrency(overdue > 0 ? overdue : pending)}
          icon={CalendarClock}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="contratos">
        <TabsList>
          <TabsTrigger value="contratos">
            Contratos ({investor.contracts.length})
          </TabsTrigger>
          <TabsTrigger value="pagos">
            Pagos ({investor.payments.length})
          </TabsTrigger>
          <TabsTrigger value="documentos">
            Documentos ({investor.documents.length})
          </TabsTrigger>
          <TabsTrigger value="info">Información</TabsTrigger>
        </TabsList>

        <TabsContent value="contratos">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Modalidad</TableHead>
                  <TableHead className="text-right">Rentab.</TableHead>
                  <TableHead>Vigencia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {investor.contracts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.code}</TableCell>
                    <TableCell className="text-right tabular">
                      {formatCurrency(c.amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {CONTRACT_MODALITY_LABELS[c.modality] ?? c.modality}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {formatPercent(c.returnRate)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(c.startDate)} → {formatDate(c.endDate)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/contratos/${c.id}`}>Ver</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {investor.contracts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      Sin contratos registrados.
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
                {investor.payments.slice(0, 24).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{PAYMENT_TYPE_LABELS[p.type] ?? p.type}</TableCell>
                    <TableCell className="text-right tabular">
                      {formatCurrency(p.amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(p.dueDate)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(p.paidDate)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                  </TableRow>
                ))}
                {investor.payments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      Sin pagos registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="documentos">
          <Card>
            <CardContent className="py-6">
              {investor.documents.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                  <FileText className="size-8 opacity-40" />
                  <p>No hay documentos adjuntos.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {investor.documents.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 py-3">
                      <FileText className="size-5 text-gold" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{d.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(d.uploadedAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>Información y notas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Info label="Fecha de ingreso" value={formatDate(investor.joinDate)} />
              <Info label="Contrato vigente" value={activeContract?.code ?? "—"} />
              <Info label="Nivel de riesgo" value={investor.riskLevel} />
              <Info label="Estado" value={investor.status} />
              <div className="sm:col-span-2">
                <p className="mb-1 text-xs text-muted-foreground">Notas</p>
                <p className="text-sm">{investor.notes || "Sin notas."}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
