# Capital Veci

Plataforma web **profesional y privada** de administración de capital e inversiones comerciales. Permite al administrador controlar capital, pagos, contratos, liquidez, reportes, movimientos, reservas y riesgos, con un portal privado para cada inversionista.

Diseño premium tipo **banca privada / firma de capital**: dark mode elegante con detalles dorados y verdes, tipografía editorial y UX de software financiero empresarial.

---

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **TailwindCSS 3** + componentes estilo **shadcn/ui** (Radix)
- **Framer Motion** (animaciones suaves)
- **Recharts** (gráficos financieros)
- **Prisma ORM** sobre **SQLite / libSQL (Turso)** mediante driver adapter
- Autenticación propia con **JWT (jose)** + **bcrypt**, sesiones en cookie httpOnly

---

## Puesta en marcha

```bash
npm install          # instala dependencias
npm run setup        # crea la base local (prisma db push) y carga datos demo
npm run dev          # arranca en http://localhost:3000
```

> `npm run setup` equivale a `prisma db push` + `prisma db seed`.

### Credenciales demo (contraseña: `demo1234`)

| Rol            | Correo                      | Acceso                          |
| -------------- | --------------------------- | ------------------------------- |
| Administrador  | `admin@capitalveci.cl`      | Todos los módulos               |
| Contador       | `contador@capitalveci.cl`   | Inversionistas, pagos, reportes |
| Operador       | `operador@capitalveci.cl`   | Operaciones, inversionistas     |
| Inversionista  | `maria.soto@example.cl`     | Portal privado (`/portal`)      |

---

## Conexión a Turso (producción)

El runtime usa el adaptador **libSQL**. En local apunta a `prisma/dev.db`; para
conectar a tu base **Turso en la nube** basta con rellenar `.env`:

```env
TURSO_DATABASE_URL="libsql://<tu-db>.turso.io"
TURSO_AUTH_TOKEN="<token>"
```

Obtén los valores con la CLI de Turso:

```bash
turso db show <tu-db> --url
turso db tokens create <tu-db>
```

No hay que cambiar código: si esas variables están presentes, la app se conecta a
Turso automáticamente. Cambia también `AUTH_SECRET` por una cadena aleatoria larga.

---

## Estructura

```
prisma/
  schema.prisma            # Modelo de datos (usuarios, inversionistas, contratos,
                           #   pagos, operaciones, movimientos, alertas, settings)
  seed.ts                  # Datos demo
src/
  app/
    login/                 # Acceso (server action + JWT)
    (app)/                 # Shell autenticado del staff (sidebar + topbar)
      dashboard/           # Resumen, flujo, estadísticas, riesgo y liquidez
      inversionistas/      # Listado, perfil, alta, documentos
      contratos/           # Listado, generador, detalle/firma/PDF, plantillas, firmas
      pagos/               # Listado, reportes
      liquidez/            # Control de liquidez + simulador
      operaciones/         # Operaciones + rendimiento
      reportes/            # Reportes profesionales
      admin/               # Usuarios, roles, bitácora
      configuracion/       # Parámetros, políticas de capital
    portal/                # Portal privado del inversionista
    api/auth/logout/       # Cierre de sesión
  components/
    ui/                    # Primitivos (button, card, table, dialog, …)
    layout/                # Sidebar, topbar, app-shell
    dashboard/             # KPI cards, charts
    shared/                # PageHeader, FilterTabs, StatusBadge
  lib/
    db.ts                  # Cliente Prisma + adaptador libSQL/Turso
    auth.ts                # Sesiones JWT, hash, permisos por rol
    constants.ts           # Estados, roles y permisos
    format.ts              # Moneda CLP, fechas, RUT
    nav.ts                 # Configuración de navegación
    data/metrics.ts        # Métricas y series del dashboard
  middleware.ts            # Protección de rutas y redirección por rol
```

---

## Scripts

| Comando             | Descripción                                  |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Servidor de desarrollo                       |
| `npm run build`     | Build de producción                          |
| `npm run start`     | Servir build de producción                   |
| `npm run setup`     | Crear DB local + datos demo                  |
| `npm run db:push`   | Sincronizar esquema con la base              |
| `npm run db:seed`   | Cargar datos demo                            |
| `npm run db:studio` | Abrir Prisma Studio                          |
| `npm run typecheck` | Verificación de tipos                        |

---

## Seguridad

- Sesiones JWT firmadas (HS256), cookie `httpOnly` con expiración de 8 h.
- Contraseñas con bcrypt (10 rondas).
- Middleware que protege todas las rutas y separa staff de inversionistas.
- Permisos por rol aplicados en UI y en las server actions (`requirePermission`).
- Bitácora de auditoría de acciones sensibles.
