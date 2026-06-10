import {
  jsonResponse,
  errorResponse,
  handleOptions,
  requireApiPermission,
  runHandler,
} from "@/lib/api/http";
import { revertLoanInstallment } from "@/lib/api/loans-service";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return handleOptions();
}

/**
 * POST /api/v1/loans/:id/revert  →  revierte todos los abonos de una cuota
 * (vuelve a PENDIENTE y la descuenta del historial de cobros).
 * Body: { installmentId }
 * Devuelve el préstamo actualizado. Útil para luego poder editar lo financiero.
 */
export function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return runHandler(async () => {
    const session = await requireApiPermission(req, "operations");
    await params; // el id de operación va implícito en la cuota
    const body = await req.json().catch(() => null);
    if (!body) return errorResponse("Body JSON inválido.", 400);

    const installmentId = String(body.installmentId || "");
    if (!installmentId) return errorResponse("Falta installmentId.", 400);

    const loan = await revertLoanInstallment(installmentId, session.sub);
    return jsonResponse({ loan });
  });
}
