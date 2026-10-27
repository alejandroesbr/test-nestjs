# FleetCore API — Sistema de Gestión de Flotas y Mantenimientos

- **Coder:** Alejandro
- **Clan:** NodeJS - AM
- **Proyecto:** FleetCore REST API (`NestJS 12` + `TypeScript` + `TypeORM` + `PostgreSQL 16` + `JWT` + `Swagger`)

---

## 1. Descripción y Arquitectura del Sistema

**FleetCore API** administra el ciclo de vida de mantenimientos preventivos y correctivos sobre la flota de vehículos de transporte de **FleetCore**, garantizando trazabilidad histórica, disponibilidad en tiempo real de unidades, control de horarios de mecánicos e integración con sistemas externos.

### Organización *Package by Feature*

El código está modularizado por dominio funcional para maximizar la cohesión y aislar responsabilidades:

```text
fleetcore-api/
├── Dockerfile                        # Contenedor multi-etapa (Node 22 Alpine)
├── docker-compose.yml                # Orquestación API + PostgreSQL 16 (red interna + volumen)
├── schema.sql                        # Esquema físico DDL, FK ON DELETE RESTRICT, CHECK e índices
├── src/
│   ├── main.ts                       # ValidationPipe global, Interceptor, ExceptionFilter y Swagger
│   ├── app.module.ts                 # ConfigModule, TypeOrmModule y APP_GUARD (JwtAuthGuard + RolesGuard)
│   ├── common/
│   │   ├── constants/roles.enum.ts   # Roles del sistema (ADMIN, TECHNICIAN)
│   │   ├── decorators/               # @Public(), @Roles(), @CurrentUser()
│   │   ├── filters/                  # HttpExceptionFilter (HttpException + SQLSTATE 23505/23503/23514/22P02)
│   │   ├── guards/                   # JwtAuthGuard, RolesGuard y ApiKeyGuard (x-api-key)
│   │   └── interceptors/             # ResponseTransformInterceptor (contrato JSON uniforme)
│   ├── database/
│   │   └── seeds/seed.ts             # Seeder idempotente topológico (Users -> Catalogs -> Maintenances)
│   └── modules/
│       ├── auth/                     # Registro, login JWT, hashing bcrypt y perfil (@CurrentUser)
│       ├── workshops/                # Gestión de talleres y desactivación lógica (status)
│       ├── vehicles/                 # Gestión de flota, búsqueda por placa y Soft Delete (@DeleteDateColumn)
│       ├── mechanics/                # Gestión de mecánicos independientes y activación/inactivación
│       └── maintenances/             # Core Domain: FSM, cruce de horarios, odómetro, transacciones y API Key
└── test/
    └── app.e2e-spec.ts               # Pruebas de humo End-to-End (Smoke Tests HTTP)
```

### Flujo de una Petición en el Pipeline Global

```text
Request HTTP
  └─► 1. JwtAuthGuard (APP_GUARD)     ──► Verifica Bearer JWT o permite paso si tiene @Public()
  └─► 2. RolesGuard (APP_GUARD)       ──► Evalúa @Roles(Role.ADMIN, Role.TECHNICIAN) contra request.user.role
  └─► 3. ValidationPipe Global        ──► whitelist: true, forbidNonWhitelisted: true, transform: true
  └─► 4. Controller                   ──► Enruta petición y delega al Servicio
  └─► 5. Service + TypeORM Repository ──► Valida invariantes de negocio y ejecuta transacciones ACID
        ├─► Éxito (2xx): ResponseTransformInterceptor ──► { success: true, statusCode, data, timestamp }
        └─► Error (4xx): HttpExceptionFilter          ──► { success: false, statusCode, message, path, timestamp }
```

---

## 2. Requisitos Previos

- **Node.js:** `v20+` (o `v22+`)
- **Gestor de paquetes:** `pnpm` o `npm`
- **Contenedores:** **Docker** y **Docker Compose** (o PostgreSQL 15+ local)

---

## 3. Instalación y Ejecución Paso a Paso

### Paso 1: Clonar el repositorio y configurar variables de entorno
```bash
git clone https://github.com/alejandroesbr/test-nestjs.git
cd test-nestjs/fleetcore-api
cp .env.example .env
```

Variables definidas en `.env`:
```ini
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=fleetcore
JWT_SECRET=change-this-secret-in-production
JWT_EXPIRES_IN=1h
API_KEYS=demo-key-partner-1,demo-key-partner-2
```

### Paso 2: Instalar dependencias
```bash
pnpm install
# o con npm:
npm install
```

### Paso 3: Levantar PostgreSQL con Docker
El servicio `postgres` monta y ejecuta automáticamente `schema.sql` al inicializar el volumen:
```bash
docker compose up -d postgres
```
*(Opcional: para levantar tanto PostgreSQL como la API en contenedores Docker usa `docker compose up -d --build`).*

### Paso 4: Ejecutar el Seeder Idempotente
Puebla la base de datos con usuarios, talleres, mecánicos, vehículos y mantenimientos de prueba. Es **idempotente** (ejecutarlo dos o más veces seguidas no duplica registros ni arroja errores de unicidad):
```bash
npm run seed
```

### Paso 5: Iniciar el servidor
```bash
# Modo desarrollo (watch)
npm run start:dev

# Modo producción
npm run build && npm run start:prod
```

---

## 4. Credenciales de Prueba y Datos Sembrados

### Usuarios Sembrados (`POST /auth/login`)

| Rol | Correo (`email`) | Contraseña (`password`) | Relación |
| :--- | :--- | :--- | :--- |
| **`ADMIN`** | `admin@fleetcore.com` | `FleetCore2026!` | Gestión total del sistema |
| **`TECHNICIAN`** | `tech1@fleetcore.com` | `FleetCore2026!` | Vinculado al mecánico activo **Carlos Ruiz** |
| **`TECHNICIAN`** | `tech2@fleetcore.com` | `FleetCore2026!` | Vinculada a la mecánica activa **Ana Gómez** |

### Llaves para Integración Externa (`x-api-key`)
Enviar en la cabecera HTTP `x-api-key` al consumir `GET /maintenances/external/history/:plate`:
- `demo-key-partner-1`
- `demo-key-partner-2`

### Vehículos Sembrados
| Placa | Vehículo | Kilometraje | Estado Inicial | Mantenimiento Asociado |
| :--- | :--- | :---: | :--- | :--- |
| `FLC-101` | Toyota Hilux (2023) | `25,500 km` | `AVAILABLE` | 1 orden `COMPLETED` (historial) |
| `FLC-102` | Ford Ranger (2024) | `12,000 km` | `AVAILABLE` | Sin órdenes activas |
| `FLC-201` | Chevrolet NHR (2022) | `48,000 km` | `IN_MAINTENANCE` | 1 orden `IN_PROGRESS` |
| `FLC-999` | Nissan Frontier (2019) | `110,000 km` | `INACTIVE` | Bloqueado para nuevos mantenimientos |

---

## 5. Documentación Interactiva (Swagger)

Con el servidor encendido, abre en el navegador:

- **Swagger UI:** http://localhost:3000/api/docs
- **OpenAPI JSON:** http://localhost:3000/api/docs-json

En el botón **Authorize** de Swagger puedes autenticarte con:
1. **`bearer` (JWT):** Pega el `accessToken` devuelto por `POST /auth/login`.
2. **`x-api-key`:** Ingresa `demo-key-partner-1` para consultar `GET /maintenances/external/history/FLC-101` sin token JWT.

---

## 6. Referencia de Endpoints y Control de Acceso (RBAC)

| Módulo | Método y Ruta | Protección / Rol | Descripción y Reglas Aplicadas |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST /auth/register` | `@Public()` | Registra usuario (`ADMIN` o `TECHNICIAN`) con hash `bcrypt`. |
| **Auth** | `POST /auth/login` | `@Public()` | Valida credenciales y firma token JWT (`200 OK`). |
| **Auth** | `GET /auth/me` | JWT (`@CurrentUser`) | Devuelve el perfil extraído del token mediante `@CurrentUser()`. |
| **Workshops** | `POST /workshops` | `ADMIN` | Registra un nuevo taller. |
| **Workshops** | `GET /workshops` | `ADMIN` | Lista únicamente talleres activos (`status: true`). |
| **Workshops** | `GET /workshops/:id` | `ADMIN` | Consulta detalle de un taller por ID. |
| **Workshops** | `PATCH /workshops/:id/deactivate` | `ADMIN` | Inactiva lógicamente un taller (`status = false`). |
| **Vehicles** | `POST /vehicles` | `ADMIN` | Registra vehículo validando placa única (incluyendo borrados lógicos). |
| **Vehicles** | `GET /vehicles` | `ADMIN` | Lista vehículos activos de la flota. |
| **Vehicles** | `GET /vehicles/plate/:plate` | `ADMIN` | Busca un vehículo por su placa única. |
| **Vehicles** | `GET /vehicles/:id` | `ADMIN` | Busca un vehículo por su identificador. |
| **Vehicles** | `PATCH /vehicles/:id` | `ADMIN` | Actualiza datos del vehículo validando colisión de placa. |
| **Vehicles** | `DELETE /vehicles/:id` | `ADMIN` | Borrado lógico (`softRemove` / `deleted_at`) preservando historial. |
| **Mechanics** | `POST /mechanics` | `ADMIN` | Registra mecánico independiente con correo único. |
| **Mechanics** | `GET /mechanics` | `ADMIN` | Lista todos los mecánicos registrados. |
| **Mechanics** | `GET /mechanics/:id` | `ADMIN` | Consulta un mecánico específico por ID. |
| **Mechanics** | `PATCH /mechanics/:id` | `ADMIN` | Actualiza datos del mecánico. |
| **Mechanics** | `PATCH /mechanics/:id/status` | `ADMIN` | Activa o inactiva un mecánico sin borrar su historial. |
| **Maintenances** | `POST /maintenances` | `ADMIN` | Crea orden `SCHEDULED`. Valida vehículo `AVAILABLE`, mecánico/taller activos, `mileage >= vehicle.mileage` y no cruce de horario (ventana de 90 min). |
| **Maintenances** | `GET /maintenances` | `ADMIN` | Lista todos los mantenimientos (filtro opcional `?status=`). |
| **Maintenances** | `GET /maintenances/active` | `ADMIN`, `TECHNICIAN` | Lista mantenimientos activos (`SCHEDULED` e `IN_PROGRESS`). |
| **Maintenances** | `GET /maintenances/vehicle/:vehicleId` | `ADMIN` | Consulta mantenimientos e historial por ID de vehículo. |
| **Maintenances** | `GET /maintenances/mechanic/:id` | `ADMIN`, `TECHNICIAN` | Consulta mantenimientos asignados a un mecánico. |
| **Maintenances** | `PATCH /maintenances/:id/status` | `ADMIN`, `TECHNICIAN` | Ejecuta transición FSM en transacción ACID sincronizando el estado y kilometraje del vehículo. |
| **External** | `GET /maintenances/external/history/:plate` | `@Public()` + `ApiKeyGuard` | Consulta externa M2M del vehículo y su historial mediante cabecera `x-api-key`. |

---

## 7. Pruebas Automatizadas, Cobertura y Volcado SQL

```bash
# 1. Ejecutar pruebas unitarias (7 suites, 36 tests)
npm run test

# 2. Ejecutar reporte de cobertura Jest (> 78% statements/lines, supera el 40% requerido)
npm run test:cov

# 3. Ejecutar pruebas de humo End-to-End (Smoke Tests HTTP)
npm run test:e2e

# 4. Verificar compilación TypeScript y Linter
npm run build
npm run lint

# 5. Generar archivo dump.sql con estructura y datos sembrados desde el contenedor
docker compose exec -T postgres pg_dump -U postgres -d fleetcore --clean > dump.sql
```
