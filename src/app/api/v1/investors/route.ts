import { jsonResponse, handleOptions, requireApiSession, runHandler } from "@/lib/api/http";
import { listInvestors } from "@/lib/api/loans-service";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return handleOptions();
}

/** GET /api/v1/investors  →  inversionistas con su capital derivado. */
export function GET(req: Request) {
  return runHandler(async () => {
    await requireApiSession(req);
    return jsonResponse({ investors: await listInvestors() });
  });
}
