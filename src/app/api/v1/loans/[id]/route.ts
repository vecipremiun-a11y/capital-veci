import {
  jsonResponse,
  errorResponse,
  handleOptions,
  requireApiSession,
  runHandler,
} from "@/lib/api/http";
import { getLoan } from "@/lib/api/loans-service";

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
