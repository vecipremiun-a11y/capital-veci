/**
 * Crea la tabla StaffAssignment (caja de capital por trabajador) en la base
 * activa — Turso o el archivo local, según .env.
 *
 *   npx tsx scripts/migrate-staff-capital.ts
 *
 * Es puramente aditiva: solo hace CREATE TABLE / CREATE INDEX con
 * "IF NOT EXISTS", así que no toca ni una fila de los datos existentes y se
 * puede correr varias veces sin problema.
 *
 * Hace falta porque la CLI de Prisma (`db push`) apunta a DATABASE_URL, que
 * en este proyecto es el archivo local; la app en cambio corre contra Turso
 * vía el adaptador libSQL (ver src/lib/db.ts).
 *
 * Para revertir:  DROP TABLE "StaffAssignment";
 */
import { createClient } from "@libsql/client";

try {
  // @ts-ignore Node >= 20.12
  process.loadEnvFile?.();
} catch {
  /* noop */
}

const url = process.env.TURSO_DATABASE_URL || "file:./prisma/dev.db";
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
const db = createClient({ url, authToken });

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "StaffAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ASSIGN',
    "amount" REAL NOT NULL,
    "note" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StaffAssignment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "StaffAssignment_userId_idx" ON "StaffAssignment"("userId")`,
  `CREATE INDEX IF NOT EXISTS "StaffAssignment_date_idx" ON "StaffAssignment"("date")`,
];

async function main() {
  console.log(`Base: ${url}\n`);

  const before = await db.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='StaffAssignment'`,
  );
  if (before.rows.length > 0) {
    console.log("La tabla StaffAssignment ya existe; no hay nada que hacer.");
    return;
  }

  for (const sql of STATEMENTS) {
    await db.execute(sql);
    console.log("  ✓ " + sql.split("\n")[0].trim());
  }

  const rows = await db.execute(`SELECT COUNT(*) n FROM StaffAssignment`);
  console.log(`\n✓ Tabla creada (${rows.rows[0]?.n} filas).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
