import {
  jsonResponse,
  errorResponse,
  handleOptions,
  requireApiSession,
  requireApiPermission,
  runHandler,
} from "@/lib/api/http";
import { listLoans, createLoan, type LoanFrequency } from "@/lib/api/loans-service";

export const dynamic = "force-dynamic";

const FREQUENCIES: LoanFrequency[] = ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"];

export function OPTIONS() {
  return handleOptions();
}

/** GET /api/v1/loans  →  lista de préstamos con su resumen. */
export function GET(req: Request) {
  return runHandler(async () => {
    await requireApiSession(req);
    return jsonResponse({ loans: await listLoans() });
  });
}

/**
 * POST /api/v1/loans  →  crea un préstamo (Operation LOANS + cuotas + asiento).
 * Body: { name, capital, returnPct, startDate, term, frequency,
 *         collectWeekdays?, borrowerName?, borrowerPhone?, riskLevel?, description? }
 */
export function POST(req: Request) {
  return runHandler(async () => {
    const session = await requireApiPermission(req, "operations");
    const body = await req.json().catch(() => null);
    if (!body) return errorResponse("Body JSON inválido.", 400);

    const name = String(body.name || "").trim();
    const capital = Number(body.capital);
    const returnPct = Number(body.returnPct);
    const term = Number(body.term);
    const frequency = String(body.frequency || "").toUpperCase() as LoanFrequency;
    const startDate = body.startDate ? new Date(body.startDate) : new Date();

    if (name.length < 3) return errorResponse("Nombre muy corto.", 400);
    if (!Number.isFinite(capital) || capital <= 0)
      return errorResponse("Capital debe ser mayor a 0.", 400);
    if (!Number.isFinite(returnPct) || returnPct < 0)
      return errorResponse("Retorno inválido.", 400);
    if (!Number.isInteger(term) || term < 1)
      return errorResponse("Número de cuotas inválido.", 400);
    if (!FREQUENCIES.includes(frequency))
      return errorResponse("Frecuencia inválida (DAILY|WEEKLY|BIWEEKLY|MONTHLY).", 400);
    if (Number.isNaN(startDate.getTime()))
      return errorResponse("Fecha de inicio inválida.", 400);

    const collectWeekdays = Array.isArray(body.collectWeekdays)
      ? body.collectWeekdays
          .map((n: unknown) => Number(n))
          .filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 6)
      : undefined;

    const loan = await createLoan(
      {
        name,
        capital,
        returnPct,
        term,
        frequency,
        startDate,
        collectWeekdays,
        borrowerName: body.borrowerName ?? null,
        borrowerPhone: body.borrowerPhone ?? null,
        riskLevel: ["LOW", "MEDIUM", "HIGH"].includes(body.riskLevel)
          ? body.riskLevel
          : "MEDIUM",
        description: body.description ?? null,
      },
      session.sub,
    );

    return jsonResponse({ loan }, 201);
  });
}
