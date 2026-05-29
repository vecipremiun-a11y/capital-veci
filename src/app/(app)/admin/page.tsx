import type { Metadata } from "next";
import { ShieldCheck, Users as UsersIcon, Activity } from "lucide-react";
import { CreateUserDialog } from "./create-user-dialog";
import { db } from "@/lib/db";
import { ROLE_LABELS, ROLE_PERMISSIONS } from "@/lib/constants";
import { formatDateTime, initials } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Panel administrador" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [users, logs] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: "desc" } }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel administrador"
        description="Gestión de usuarios, roles, permisos y bitácora del sistema."
      >
        <CreateUserDialog />
      </PageHeader>

      {/* Roles & permisos */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(ROLE_LABELS).map(([key, label]) => (
          <Card key={key}>
            <CardHeader>
              <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-gold/10 text-gold">
                <ShieldCheck className="size-5" />
              </div>
              <CardTitle className="text-base">{label}</CardTitle>
              <CardDescription>
                {ROLE_PERMISSIONS[key]?.length ?? 0} permisos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {(ROLE_PERMISSIONS[key] ?? []).slice(0, 5).map((p) => (
                  <Badge key={p} variant="muted" className="text-[10px]">
                    {p}
                  </Badge>
                ))}
                {(ROLE_PERMISSIONS[key]?.length ?? 0) > 5 && (
                  <Badge variant="outline" className="text-[10px]">
                    +{(ROLE_PERMISSIONS[key]?.length ?? 0) - 5}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Usuarios */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <UsersIcon className="size-5 text-gold" />
            <CardTitle>Usuarios del sistema</CardTitle>
          </div>
          <Badge variant="muted">{users.length} cuentas</Badge>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Último ingreso</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback>{initials(u.name)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{u.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <Badge variant={u.role === "ADMIN" ? "gold" : "muted"}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={u.active ? "success" : "danger"}>
                    {u.active ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Bitácora */}
      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <Activity className="size-5 text-gold" />
          <CardTitle>Bitácora del sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {logs.map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between rounded-lg border-b border-border/50 py-2 last:border-0"
            >
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-[10px]">
                  {l.action}
                </Badge>
                <span className="text-sm">
                  {l.detail ?? `${l.entity ?? ""} ${l.entityId ?? ""}`}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {l.user?.name ?? "Sistema"} · {formatDateTime(l.createdAt)}
              </div>
            </div>
          ))}
          {logs.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sin actividad registrada.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
