import {
  jsonResponse,
  errorResponse,
  handleOptions,
  requireApiSession,
  requireApiPermission,
  runHandler,
} from "@/lib/api/http";
import { getLoan, updateLoan, deleteLoan } from "@/lib/api/loans-service";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return handleOptions();
}

/** GET /api/v1/loans/:id  →  detalle del préstamo con cuotas y cobros. */
export function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return runHandler(async () => {
    await requireApiSession(req);
    const { id } = await params;
    const loan = await getLoan(id);
    if (!loan) return errorResponse("Préstamo no encontrado.", 404);
    return jsonResponse({ loan });
  });
}

/**
 * PATCH /api/v1/loans/:id  →  edita un préstamo.
 * Body parcial: { name?, capital?, returnPct?, startDate?, frequency?,
 *   term? | installmentAmount?, collectWeekdays?, borrowerName?, borrowerPhone?,
 *   riskLevel?, description? }
 * Si el préstamo tiene cobros y se envían campos financieros → 409 (revertir primero).
 * Sin cobros se regenera el calendario. Devuelve el préstamo actualizado.
 */
export function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return runHandler(async () => {
    const session = await requireApiPermission(req, "operations");
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object")
      return errorResponse("Body JSON inválido.", 400);
    const loan = await updateLoan(id, body, session.sub);
    return jsonResponse({ loan });
  });
}

/**
 * DELETE /api/v1/loans/:id  →  elimina un préstamo creado por error.
 * Solo si no tiene cobros ni está cerrado (si no, 409).
 */
export function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return runHandler(async () => {
    const session = await requireApiPermission(req, "operations");
    const { id } = await params;
    await deleteLoan(id, session.sub);
    return jsonResponse({ ok: true });
  });
}
