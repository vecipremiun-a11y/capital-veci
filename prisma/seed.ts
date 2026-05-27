/**
 * Seed de datos demo para Capital Veci.
 * Ejecutar con: npm run db:seed  (carga .env vía Prisma) o `npx prisma db seed`.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

// Carga .env si está disponible (Node >= 20.12).
try {
  // @ts-ignore
  process.loadEnvFile?.();
} catch {
  /* noop: prisma db seed ya carga .env */
}

const url = process.env.TURSO_DATABASE_URL || "file:./prisma/dev.db";
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
const adapter = new PrismaLibSQL({ url, authToken });
const db = new PrismaClient({ adapter });

const DEMO_PASSWORD = "demo1234";

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
function monthsFromNow(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d;
}

async function main() {
  console.log("→ Limpiando datos previos…");
  await db.auditLog.deleteMany();
  await db.alert.deleteMany();
  await db.capitalMovement.deleteMany();
  await db.document.deleteMany();
  await db.payment.deleteMany();
  await db.contract.deleteMany();
  await db.user.deleteMany();
  await db.investor.deleteMany();
  await db.operation.deleteMany();
  await db.companySettings.deleteMany();

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // -------------------- Configuración --------------------
  await db.companySettings.create({
    data: {
      id: "singleton",
      companyName: "Capital Veci",
      legalName: "Veci Administración de Capital SpA",
      taxId: "76.543.210-8",
      currency: "CLP",
      reservePercentage: 20,
      minLiquidity: 80_000_000,
      maxCommitment: 75,
      alertsEnabled: true,
    },
  });

  // -------------------- Inversionistas --------------------
  const investorsData = [
    {
      fullName: "María Fernanda Soto",
      rut: "12345678-9",
      email: "maria.soto@example.cl",
      phone: "+56 9 8123 4567",
      status: "ACTIVE",
      investedCapital: 120_000_000,
      expectedReturn: 14,
      riskLevel: "LOW",
      joinDate: monthsFromNow(-18),
    },
    {
      fullName: "Roberto Cárcamo Vidal",
      rut: "9876543-2",
      email: "rcarcamo@example.cl",
      phone: "+56 9 7654 3210",
      status: "ACTIVE",
      investedCapital: 85_000_000,
      expectedReturn: 12,
      riskLevel: "LOW",
      joinDate: monthsFromNow(-10),
    },
    {
      fullName: "Inversiones Andinas Ltda.",
      rut: "77123456-7",
      email: "contacto@andinas.cl",
      phone: "+56 2 2987 6543",
      status: "ACTIVE",
      investedCapital: 240_000_000,
      expectedReturn: 16,
      riskLevel: "MEDIUM",
      joinDate: monthsFromNow(-24),
    },
    {
      fullName: "Camila Reyes Tapia",
      rut: "15678234-5",
      email: "camila.reyes@example.cl",
      phone: "+56 9 9988 7766",
      status: "RISK",
      investedCapital: 45_000_000,
      expectedReturn: 18,
      riskLevel: "HIGH",
      joinDate: monthsFromNow(-6),
    },
    {
      fullName: "Jorge Aravena Núñez",
      rut: "8456123-K",
      email: "jaravena@example.cl",
      phone: "+56 9 5566 7788",
      status: "ACTIVE",
      investedCapital: 60_000_000,
      expectedReturn: 13,
      riskLevel: "MEDIUM",
      joinDate: monthsFromNow(-14),
    },
    {
      fullName: "Patricia Lagos Mella",
      rut: "11223344-5",
      email: "plagos@example.cl",
      phone: "+56 9 2233 4455",
      status: "FINISHED",
      investedCapital: 30_000_000,
      expectedReturn: 11,
      riskLevel: "LOW",
      joinDate: monthsFromNow(-30),
    },
    {
      fullName: "Grupo Comercial del Sur S.A.",
      rut: "78998877-6",
      email: "finanzas@gcsur.cl",
      phone: "+56 41 2123 456",
      status: "ACTIVE",
      investedCapital: 180_000_000,
      expectedReturn: 15,
      riskLevel: "MEDIUM",
      joinDate: monthsFromNow(-20),
    },
    {
      fullName: "Andrés Pizarro Fuentes",
      rut: "16789012-3",
      email: "apizarro@example.cl",
      phone: "+56 9 4455 6677",
      status: "ACTIVE",
      investedCapital: 95_000_000,
      expectedReturn: 14,
      riskLevel: "LOW",
      joinDate: monthsFromNow(-8),
    },
  ];

  const investors = [];
  for (const data of investorsData) {
    investors.push(await db.investor.create({ data }));
  }
  console.log(`→ ${investors.length} inversionistas creados`);

  // -------------------- Usuarios --------------------
  await db.user.createMany({
    data: [
      {
        email: "admin@capitalveci.cl",
        name: "Administrador General",
        passwordHash: hash,
        role: "ADMIN",
      },
      {
        email: "contador@capitalveci.cl",
        name: "Claudia Méndez (Contadora)",
        passwordHash: hash,
        role: "CONTADOR",
      },
      {
        email: "operador@capitalveci.cl",
        name: "Felipe Rojas (Operador)",
        passwordHash: hash,
        role: "OPERADOR",
      },
    ],
  });
  // Usuario inversionista vinculado (portal privado)
  await db.user.create({
    data: {
      email: "maria.soto@example.cl",
      name: "María Fernanda Soto",
      passwordHash: hash,
      role: "INVERSIONISTA",
      investorId: investors[0].id,
    },
  });
  console.log("→ Usuarios creados (admin/contador/operador/inversionista)");

  // -------------------- Contratos + Pagos --------------------
  let contractSeq = 1000;
  for (const inv of investors) {
    if (inv.status === "FINISHED") continue;
    const durationMonths = 12;
    const startDate = inv.joinDate;
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + durationMonths);

    const contract = await db.contract.create({
      data: {
        code: `CTR-${++contractSeq}`,
        investorId: inv.id,
        amount: inv.investedCapital,
        durationMonths,
        returnRate: inv.expectedReturn,
        modality: inv.riskLevel === "HIGH" ? "PARTICIPATION" : "FIXED",
        paymentFrequency: "MONTHLY",
        periodicInterestPct: 100,
        startDate,
        endDate,
        status: inv.status === "RISK" ? "ACTIVE" : "SIGNED",
        signedAt: inv.status === "RISK" ? null : startDate,
        signatureName: inv.status === "RISK" ? null : inv.fullName,
        conditions:
          "Capital destinado a operaciones comerciales privadas. Interés mensual + devolución de capital al término del plazo.",
      },
    });

    // Pagos mensuales de interés
    const monthlyInterest = Math.round(
      (inv.investedCapital * (inv.expectedReturn / 100)) / 12,
    );
    for (let m = -6; m <= 5; m++) {
      const dueDate = monthsFromNow(m);
      let status: string;
      let paidDate: Date | null = null;
      if (m < 0) {
        status = "PAID";
        paidDate = dueDate;
      } else if (m === 0) {
        status = inv.status === "RISK" ? "OVERDUE" : "PENDING";
      } else {
        status = "SCHEDULED";
      }
      // Inversionista en riesgo: dos cuotas vencidas
      if (inv.status === "RISK" && (m === -1 || m === 0)) {
        status = "OVERDUE";
        paidDate = null;
      }
      await db.payment.create({
        data: {
          investorId: inv.id,
          contractId: contract.id,
          type: "INTEREST",
          amount: monthlyInterest,
          dueDate,
          paidDate,
          status,
          method: status === "PAID" ? "Transferencia" : null,
          reference: status === "PAID" ? `TRX-${contractSeq}-${m + 6}` : null,
        },
      });
    }

    // Devolución de capital agendada al vencimiento del contrato
    await db.payment.create({
      data: {
        investorId: inv.id,
        contractId: contract.id,
        type: "CAPITAL_RETURN",
        amount: inv.investedCapital,
        dueDate: endDate,
        status: "SCHEDULED",
      },
    });
  }
  console.log("→ Contratos y pagos generados (con devolución de capital)");

  // -------------------- Operaciones comerciales --------------------
  const operations = [
    {
      code: "OP-2401",
      name: "Importación de maquinaria agrícola",
      description:
        "Financiamiento de lote de maquinaria para distribuidor regional.",
      capitalUsed: 150_000_000,
      expectedReturn: 18,
      status: "ACTIVE",
      riskLevel: "MEDIUM",
      startDate: monthsFromNow(-4),
      endDate: monthsFromNow(2),
    },
    {
      code: "OP-2402",
      name: "Compra de inventario retail",
      description: "Capital de trabajo para cadena de tiendas de conveniencia.",
      capitalUsed: 90_000_000,
      expectedReturn: 14,
      status: "ACTIVE",
      riskLevel: "LOW",
      startDate: monthsFromNow(-3),
      endDate: monthsFromNow(3),
    },
    {
      code: "OP-2403",
      name: "Factoring de facturas comerciales",
      description: "Adquisición de cartera de facturas de proveedores.",
      capitalUsed: 120_000_000,
      expectedReturn: 16,
      actualReturn: 16.5,
      status: "FINISHED",
      riskLevel: "LOW",
      startDate: monthsFromNow(-9),
      endDate: monthsFromNow(-1),
      result: "Operación cerrada con rentabilidad superior a la esperada.",
    },
    {
      code: "OP-2404",
      name: "Desarrollo inmobiliario etapa I",
      description: "Aporte a proyecto habitacional en zona urbana.",
      capitalUsed: 200_000_000,
      expectedReturn: 22,
      status: "RISK",
      riskLevel: "HIGH",
      startDate: monthsFromNow(-7),
      endDate: monthsFromNow(5),
      result: "Retrasos en permisos; en seguimiento de riesgo.",
    },
    {
      code: "OP-2405",
      name: "Exportación de productos del mar",
      description: "Financiamiento de campaña de exportación a Asia.",
      capitalUsed: 75_000_000,
      expectedReturn: 19,
      status: "ACTIVE",
      riskLevel: "MEDIUM",
      startDate: monthsFromNow(-2),
      endDate: monthsFromNow(4),
    },
  ];
  const createdOps = [];
  for (const op of operations) {
    createdOps.push(await db.operation.create({ data: op }));
  }
  console.log(`→ ${createdOps.length} operaciones comerciales creadas`);

  // -------------------- Movimientos de capital --------------------
  const totalCapital = investors.reduce(
    (s, i) => s + i.investedCapital,
    0,
  );
  await db.capitalMovement.createMany({
    data: [
      {
        type: "INFLOW",
        amount: totalCapital,
        category: "Aportes de inversionistas",
        description: "Capital total aportado acumulado",
        date: monthsFromNow(-24),
      },
      {
        type: "RESERVE",
        amount: Math.round(totalCapital * 0.2),
        category: "Reserva de liquidez",
        description: "Reserva del 20% del capital administrado",
        date: monthsFromNow(-1),
      },
      ...createdOps.map((op) => ({
        type: "COMMITTED",
        amount: op.capitalUsed,
        category: "Capital comprometido",
        description: `Capital destinado a ${op.name}`,
        date: op.startDate,
        operationId: op.id,
      })),
      {
        type: "RETURN",
        amount: 124_000_000,
        category: "Retornos de operaciones",
        description: "Retorno de factoring OP-2403",
        date: monthsFromNow(-1),
      },
    ],
  });
  console.log("→ Movimientos de capital registrados");

  // -------------------- Alertas --------------------
  await db.alert.createMany({
    data: [
      {
        level: "DANGER",
        title: "Pagos vencidos",
        message:
          "Camila Reyes Tapia tiene 2 cuotas de interés vencidas por un total relevante.",
        category: "Pagos",
      },
      {
        level: "WARNING",
        title: "Operación en riesgo",
        message:
          "OP-2404 (Desarrollo inmobiliario) presenta retrasos en permisos.",
        category: "Operaciones",
      },
      {
        level: "WARNING",
        title: "Vencimientos próximos",
        message: "3 contratos vencen dentro de los próximos 60 días.",
        category: "Contratos",
      },
      {
        level: "INFO",
        title: "Liquidez saludable",
        message: "El margen de liquidez se mantiene sobre el mínimo exigido.",
        category: "Liquidez",
      },
    ],
  });

  await db.auditLog.create({
    data: {
      action: "SEED",
      entity: "System",
      detail: "Carga inicial de datos demo",
    },
  });

  console.log("\n✓ Seed completado.");
  console.log("  Credenciales demo (contraseña: demo1234):");
  console.log("   • admin@capitalveci.cl       (Administrador)");
  console.log("   • contador@capitalveci.cl    (Contador)");
  console.log("   • operador@capitalveci.cl    (Operador)");
  console.log("   • maria.soto@example.cl      (Inversionista — portal)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
