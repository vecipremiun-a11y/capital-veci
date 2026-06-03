import "server-only";
import { NextResponse } from "next/server";
import { getBearerSession, hasPermission, type SessionUser } from "@/lib/auth";

/**
 * Utilidades comunes para las rutas /api/v1 consumidas por la app externa:
 * CORS, respuestas JSON y autenticación por Bearer token (mismo JWT que la web).
 */

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function jsonResponse(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

export function errorResponse(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: CORS_HEADERS });
}

/** Responde a los preflight OPTIONS del navegador (Flutter web). */
export function handleOptions(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Exige un Bearer token válido. Lanza ApiError 401 si no hay sesión. */
export async function requireApiSession(req: Request): Promise<SessionUser> {
  const session = await getBearerSession(req);
  if (!session) {
    throw new ApiError("No autorizado. Inicia sesión.", 401);
  }
  return session;
}

/** Exige sesión + permiso. Lanza ApiError 401/403. */
export async function requireApiPermission(
  req: Request,
  permission: string,
): Promise<SessionUser> {
  const session = await requireApiSession(req);
  if (!hasPermission(session.role, permission)) {
    throw new ApiError("No tienes permiso para esta acción.", 403);
  }
  return session;
}

/** Envuelve un handler para convertir ApiError/errores en respuestas JSON. */
export async function runHandler(
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError) return errorResponse(e.message, e.status);
    const message = e instanceof Error ? e.message : "Error interno.";
    return errorResponse(message, 500);
  }
}
