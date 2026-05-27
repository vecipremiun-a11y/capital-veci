import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

/**
 * Cliente Prisma usando el adaptador libSQL.
 *
 * - En desarrollo local (sin credenciales Turso) apunta a un archivo
 *   SQLite: ./prisma/dev.db.
 * - En producción, si TURSO_DATABASE_URL está definido, se conecta a la
 *   base de datos Turso en la nube. Solo hay que rellenar las variables
 *   de entorno; no se cambia ni una línea de código.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = process.env.TURSO_DATABASE_URL || "file:./prisma/dev.db";
  const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

  // En Prisma 6.19 el adaptador recibe la configuración libSQL directamente.
  const adapter = new PrismaLibSQL({ url, authToken });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
