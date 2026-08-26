import {
  LayoutDashboard,
  Users,
  FileSignature,
  Wallet,
  Droplets,
  Briefcase,
  BarChart3,
  ShieldCheck,
  Settings,
  HandCoins,
  PiggyBank,
  type LucideIcon,
} from "lucide-react";

export interface NavSubItem {
  label: string;
  href: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Permiso requerido (ver ROLE_PERMISSIONS). */
  permission: string;
  children?: NavSubItem[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/** Navegación del panel de administración (staff). */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Visión general",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        permission: "dashboard",
        children: [
          { label: "Resumen general", href: "/dashboard" },
          { label: "Flujo financiero", href: "/dashboard/flujo" },
          { label: "Estadísticas", href: "/dashboard/estadisticas" },
          { label: "Riesgo y liquidez", href: "/dashboard/riesgo" },
        ],
      },
    ],
  },
  {
    title: "Gestión de capital",
    items: [
      {
        label: "Inversionistas",
        href: "/inversionistas",
        icon: Users,
        permission: "investors",
        children: [
          { label: "Todos", href: "/inversionistas" },
          { label: "Activos", href: "/inversionistas?estado=ACTIVE" },
          { label: "Finalizados", href: "/inversionistas?estado=FINISHED" },
          { label: "En riesgo", href: "/inversionistas?estado=RISK" },
          { label: "Documentos", href: "/inversionistas/documentos" },
        ],
      },
      {
        label: "Contratos",
        href: "/contratos",
        icon: FileSignature,
        permission: "contracts",
        children: [
          { label: "Generar contrato", href: "/contratos/nuevo" },
          { label: "Contratos activos", href: "/contratos?estado=ACTIVE" },
          { label: "Vencidos", href: "/contratos?estado=EXPIRED" },
          { label: "Plantillas", href: "/contratos/plantillas" },
          { label: "Firmas", href: "/contratos/firmas" },
        ],
      },
      {
        label: "Pagos",
        href: "/pagos",
        icon: Wallet,
        permission: "payments",
        children: [
          { label: "Historial", href: "/pagos" },
          { label: "Pendientes", href: "/pagos?estado=PENDING" },
          { label: "Vencidos", href: "/pagos?estado=OVERDUE" },
          { label: "Programados", href: "/pagos?estado=SCHEDULED" },
          { label: "Reportes", href: "/pagos/reportes" },
        ],
      },
    ],
  },
  {
    title: "Operación",
    items: [
      {
        label: "Liquidez",
        href: "/liquidez",
        icon: Droplets,
        permission: "liquidity",
      },
      {
        label: "Operaciones",
        href: "/operaciones",
        icon: Briefcase,
        permission: "operations",
        children: [
          { label: "Activas", href: "/operaciones?estado=ACTIVE" },
          { label: "Finalizadas", href: "/operaciones?estado=FINISHED" },
          { label: "En riesgo", href: "/operaciones?estado=RISK" },
          { label: "Cobros del día", href: "/operaciones/cobros" },
          { label: "Rendimiento", href: "/operaciones/rendimiento" },
        ],
      },
      {
        label: "Trabajadores",
        href: "/trabajadores",
        icon: HandCoins,
        permission: "staff_capital",
      },
      {
        label: "Mi caja",
        href: "/mi-caja",
        icon: PiggyBank,
        permission: "own_capital",
      },
      {
        label: "Reportes",
        href: "/reportes",
        icon: BarChart3,
        permission: "reports",
      },
    ],
  },
  {
    title: "Administración",
    items: [
      {
        label: "Panel admin",
        href: "/admin",
        icon: ShieldCheck,
        permission: "admin",
      },
      {
        label: "Configuración",
        href: "/configuracion",
        icon: Settings,
        permission: "settings",
      },
    ],
  },
];
