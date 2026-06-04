# API v1 — Contrato para apps externas (Capital Veci)

API REST que consume la app móvil de cobros (Flutter). Vive en este mismo
proyecto Next.js bajo `/api/v1`. La lógica financiera se comparte con el panel
(`src/lib/api/loans-service.ts`), así que lo que la app crea/cobra se refleja en
el dashboard de operaciones automáticamente.

- **Base URL:** `https://<dominio-produccion>/api/v1` (local: `http://localhost:3001/api/v1`)
- **Auth:** JWT (mismas cuentas que la web). Login devuelve `token`; enviarlo en
  `Authorization: Bearer <token>` en todas las rutas salvo login. Token ~30 días.
- **Errores:** siempre JSON `{ "error": "mensaje" }` con HTTP 400/401/403/404/500.
- **Montos:** CLP enteros. **Fechas:** ISO.
- **Permisos:** crear/cobrar requieren rol con permiso `operations` (si no → 403).

## Auth
- `POST /auth/login` `{ email, password }` → `{ token, user:{id,name,email,role,investorId} }`
- `GET /auth/me` (Bearer) → `{ user:{...} }`

## Préstamos  (Operation category="LOANS", isDailyLoan=true)
- `GET /loans` → `{ loans:[ { id, code, name, borrowerName, borrowerPhone,
  capital, expectedReturn, status, riskLevel, startDate, endDate, total, paid,
  outstanding, installmentsCount, paidCount, frequency, frequencyLabel } ] }`
- `GET /loans/:id` → `{ loan:{ ...resumen, installments:[{id,sequence,dueDate,
  amount,paidAmount,remaining,status,paidDate}], payments:[{id,amount,method,date}] } }`
- `POST /loans` → `{ loan }` (201). Body:
  `{ name, capital, returnPct, term, frequency(DAILY|WEEKLY|BIWEEKLY|MONTHLY),
     startDate, borrowerName?, borrowerPhone?, riskLevel?, collectWeekdays?(DAILY), description? }`
  - total = `round(capital*(1+returnPct/100))`; cuota = `floor(total/term)`, la
    última absorbe el redondeo. Espaciado: DAILY +1d (días hábiles), WEEKLY +7d,
    BIWEEKLY +15d, MONTHLY +1 mes.
  - Crea Operation + LoanInstallment(s) + CapitalMovement(COMMITTED) en una transacción.
  - La frecuencia se guarda como etiqueta `[freq:X]` dentro de `description`
    (sin columna propia todavía) y se lee de vuelta en los GET.
- `POST /loans/:id/collect` → `{ result:{ applied, leftover, installmentsTouched } }`.
  Body `{ installmentId, amount, method? }`. El excedente cae en cascada a las
  cuotas siguientes. Crea un `LoanPayment` con `allocations`. No mueve liquidez.

## Resumen
- `GET /summary` → `{ outstanding, lentCapital, estimatedProfit,
  collectedThisMonth, totalCollected, clientsCount, activeLoansCount,
  overdueCount, upcoming:[{operationId,borrowerName,sequence,dueDate,remaining}] }`

## Inversiones (solo lectura)
- `GET /investors` → `{ investors:[{ id, fullName, rut, email, phone, status,
  riskLevel, investedCapital, expectedReturn, contractsCount }] }`
- `GET /contracts` → `{ contracts:[{ id, code, investorName, amount, returnRate,
  modality, paymentFrequency, durationMonths, startDate, endDate, status, committed }] }`

> Pendiente coordinado: agregar columna real de `frequency` al esquema (hoy va en
> `description`). Requiere migración en la base Turso compartida.
