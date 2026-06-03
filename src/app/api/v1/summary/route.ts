import { jsonResponse, handleOptions, requireApiSession, runHandler } from "@/lib/api/http";
import { loanSummary } from "@/lib/api/loans-service";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return handleOptions();
}

/** GET /api/v1/summary  →  números del panel de préstamos (por cobrar, cobrado, etc). */
export function GET(req: Request) {
  return runHandler(async () => {
    await requireApiSession(req);
    return jsonResponse(await loanSummary());
  });
}
