import {
  jsonResponse,
  errorResponse,
  handleOptions,
  requireApiPermission,
  runHandler,
} from "@/lib/api/http";
import { collectLoan } from "@/lib/api/loans-service";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return handleOptions();
}

/**
 * POST /api/v1/loans/:id/collect  →  registra un abono.
 * Body: { installmentId, amount, method? }
 * El excedente se aplica en cascada a las cuotas siguientes.
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
    const amount = Number(body.amount);
    const method = body.method ? String(body.method) : "Efectivo";
    if (!installmentId) return errorResponse("Falta installmentId.", 400);

    const result = await collectLoan(installmentId, amount, method, session.sub);
    return jsonResponse({ result });
  });
}
