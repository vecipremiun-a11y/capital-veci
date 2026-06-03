import { jsonResponse, handleOptions, requireApiSession, runHandler } from "@/lib/api/http";
import { listContracts } from "@/lib/api/loans-service";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return handleOptions();
}

/** GET /api/v1/contracts  →  contratos de inversión (inversiones). */
export function GET(req: Request) {
  return runHandler(async () => {
    await requireApiSession(req);
    return jsonResponse({ contracts: await listContracts() });
  });
}
