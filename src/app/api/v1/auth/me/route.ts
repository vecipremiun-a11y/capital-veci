import { jsonResponse, handleOptions, requireApiSession, runHandler } from "@/lib/api/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return handleOptions();
}

/** GET /api/v1/auth/me  →  datos del usuario del token (valida la sesión). */
export function GET(req: Request) {
  return runHandler(async () => {
    const s = await requireApiSession(req);
    return jsonResponse({
      user: {
        id: s.sub,
        name: s.name,
        email: s.email,
        role: s.role,
        investorId: s.investorId ?? null,
      },
    });
  });
}
