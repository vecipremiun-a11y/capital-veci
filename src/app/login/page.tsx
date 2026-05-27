import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import {
  BarChart3,
  Database,
  Lock,
  Mail,
  ShieldCheck,
  TrendingUp,
  User,
  Users,
} from "lucide-react";

export const metadata: Metadata = { title: "Acceso" };

const features = [
  {
    icon: ShieldCheck,
    text: "Control de capital y reservas en tiempo real",
  },
  {
    icon: BarChart3,
    text: "Rentabilidad, pagos y vencimientos centralizados",
  },
  {
    icon: Lock,
    text: "Acceso privado por roles y portal de inversionista",
  },
];

const trust = [
  { icon: ShieldCheck, text: "Seguro y confidencial" },
  { icon: Database, text: "Datos protegidos" },
  { icon: Users, text: "Acceso controlado" },
];

export default function LoginPage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      {/* Fondo — foto de edificio (public/cvportada.png) + capas para legibilidad */}
      <div className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/cvportada.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40" />
        <div className="absolute inset-0 bg-background/30" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col items-stretch justify-center gap-12 px-6 py-12 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:px-12">
        {/* Panel izquierdo — marca */}
        <section className="flex flex-col justify-between gap-12 lg:max-w-xl lg:py-4">
          {/* Logo / monograma */}
          <div className="flex flex-col gap-3">
            <div className="flex items-end gap-3">
              <span className="gold-text font-display text-7xl font-bold leading-none">
                CV
              </span>
              <TrendingUp className="mb-2 size-7 text-gold" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-display text-3xl font-semibold tracking-[0.35em] text-foreground">
                CAPITAL VECI
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.45em] text-muted-foreground">
                Capital privado
              </p>
            </div>
          </div>

          <div className="max-w-md space-y-6">
            <h1 className="font-display text-4xl font-semibold leading-tight text-balance sm:text-5xl">
              Administración de{" "}
              <span className="gold-text">capital privado</span> con control
              total.
            </h1>
            <p className="text-muted-foreground">
              Gestione capital, contratos, pagos, liquidez y riesgo en una sola
              plataforma. Diseñada para administradores, contadores e
              inversionistas que exigen confianza y discreción.
            </p>

            <div className="gold-rule max-w-[6rem]" />

            <ul className="space-y-4">
              {features.map(({ icon: Icon, text }) => (
                <li
                  key={text}
                  className="flex items-center gap-3 text-sm text-muted-foreground"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gold/30 bg-gold/10">
                    <Icon className="size-4 text-gold" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Capital Veci
            <br />
            Plataforma privada de gestión financiera
          </p>
        </section>

        {/* Panel derecho — tarjeta de acceso */}
        <section className="flex w-full justify-center lg:w-auto">
          <div className="glass-panel w-full max-w-md rounded-2xl p-8 shadow-card sm:p-10">
            {/* Insignia */}
            <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
              <ShieldCheck className="size-7 text-gold" />
            </div>

            <div className="mt-6 text-center">
              <h2 className="font-display text-2xl font-semibold">
                Acceso a la plataforma
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ingrese sus credenciales para continuar
              </p>
            </div>

            <div className="mt-8">
              <LoginForm />
            </div>

            {/* Divisor */}
            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">ó</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Credenciales demo */}
            <div className="rounded-lg border border-gold/20 bg-card/40 p-4 text-xs text-muted-foreground">
              <p className="mb-2 font-medium text-gold">Credenciales demo</p>
              <p className="flex items-center gap-2">
                <Mail className="size-3.5 text-gold" />
                <span className="text-gold">admin@capitalveci.cl</span> ·
                contraseña <span className="text-gold">demo1234</span>
              </p>
              <p className="mt-1.5 flex items-center gap-2">
                <User className="size-3.5 text-gold" />
                Inversionista:{" "}
                <span className="text-gold">maria.soto@example.cl</span>
              </p>
            </div>

            {/* Confianza */}
            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-border pt-6">
              {trust.map(({ icon: Icon, text }) => (
                <div
                  key={text}
                  className="flex flex-col items-center gap-2 text-center"
                >
                  <Icon className="size-5 text-gold" />
                  <span className="text-[11px] leading-tight text-muted-foreground">
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
