import { db } from "@/lib/db";
import { verifyPassword, signSessionToken } from "@/lib/auth";
import {
  jsonResponse,
  errorResponse,
  handleOptions,
  runHandler,
} from "@/lib/api/http";

export const dynamic = "force-dynamic";

// Token de la app con vida más larga que la cookie web (30 días).
const APP_TOKEN_MAX_AGE = 60 * 60 * 24 * 30;

export function OPTIONS() {
  return handleOptions();
}

/**
 * POST /api/v1/auth/login
 * Body: { email, password }  →  { token, user }
 * Valida contra la MISMA tabla User que la web (bcrypt + JWT compartido).
 */
export function POST(req: Request) {
  return runHandler(async () => {
    const body = await req.json().catch(() => null);
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (!email || !password) {
      return errorResponse("Ingresa tu correo y contraseña.", 400);
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.active) {
      return errorResponse("Credenciales inválidas o usuario inactivo.", 401);
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return errorResponse("Credenciales inválidas.", 401);

    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await db.auditLog.create({
      data: { userId: user.id, action: "LOGIN", entity: "User", entityId: user.id },
    });

    const token = await signSessionToken(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        investorId: user.investorId,
      },
      APP_TOKEN_MAX_AGE,
    );

    return jsonResponse({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        investorId: user.investorId,
      },
    });
  });
}
