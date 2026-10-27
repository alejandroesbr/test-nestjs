# FleetCore API — Sistema de Gestión de Flotas y Mantenimientos

- **Coder:** Alejandro
- **Clan:** Riwi
- **Proyecto:** FleetCore REST API (NestJS + TypeScript + TypeORM + PostgreSQL)

---

## 1. Descripción General

**FleetCore API** es una API RESTful construida bajo arquitectura **Package by Feature** y principios de **Domain-Driven Design (DDD)** para administrar el ciclo de vida de una flota vehicular, talleres autorizados, mecánicos independientes y órdenes de mantenimiento automotriz.

Características principales:
- **Autenticación y Autorización (RBAC):** JWT Bearer sin estado (*stateless*), contraseñas hasheadas con `bcrypt` y control de acceso por roles (`ADMIN`, `TECHNICIAN`) activo por defecto (`APP_GUARD`).
- **Integración Externa M2M (`x-api-key`):** Endpoint público protegido con `ApiKeyGuard` para consultar el historial de mantenimientos por placa.
- **Pipeline Global:** `ValidationPipe` estricto (`whitelist`, `forbidNonWhitelisted`, `transform`), `ResponseTransformInterceptor` y `HttpExceptionFilter` con mapeo de errores SQL de PostgreSQL (`23505`, `23503`, `23514`, `22P02`).
- **Persistencia e Integridad Relacional:** PostgreSQL con `schema.sql` idempotente, borrado lógico (`@DeleteDateColumn`), restricciones `ON DELETE RESTRICT`, `CHECK` constraints e índice único parcial para mantenimientos activos por vehículo.

---

## 2. Requisitos Previos

- **Node.js:** `v20+` (o `v22+`)
- **Gestor de paquetes:** `pnpm` (vía Corepack) o `npm`
- **Base de datos:** **Docker** y **Docker Compose** (o instancia local de PostgreSQL 15+)

---

## 3. Instalación y Puesta en Marcha Paso a Paso

### Paso 1: Clonar el repositorio y entrar al directorio
```bash
git clone https://github.com/alejandroesbr/test-nestjs.git
cd test-nestjs/fleetcore-api
```

### Paso 2: Configurar las variables de entorno
Copia el archivo de ejemplo `.env.example` a `.env`:
```bash
cp .env.example .env
```

Variables requeridas en `.env`:
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

### Paso 3: Instalar dependencias
```bash
pnpm install
# o con npm:
npm install
```

### Paso 4: Levantar PostgreSQL con Docker
El contenedor de PostgreSQL ejecuta automáticamente `schema.sql` al iniciar:
```bash
docker compose up -d postgres
```

### Paso 5: Ejecutar el Seeder Idempotente
Carga los datos iniciales de prueba (usuarios, talleres, mecánicos, vehículos y mantenimientos). Puedes ejecutarlo múltiples veces sin duplicar registros:
```bash
pnpm run seed
# o con npm:
npm run seed
```

### Paso 6: Iniciar el servidor
```bash
# Modo desarrollo (watch)
pnpm run start:dev

# Modo producción
pnpm run build && pnpm run start:prod
```

---

## 4. Credenciales de Prueba (Cargadas por `npm run seed`)

### Usuarios (Login en `POST /auth/login`)

| Rol | Correo (`email`) | Contraseña (`password`) | Vínculo |
| :--- | :--- | :--- | :--- |
| **`ADMIN`** | `admin@fleetcore.com` | `FleetCore2026!` | Administrador general |
| **`TECHNICIAN`** | `tech1@fleetcore.com` | `FleetCore2026!` | Mecánico activo: Carlos Ruiz |
| **`TECHNICIAN`** | `tech2@fleetcore.com` | `FleetCore2026!` | Mecánica activa: Ana Gómez |

### API Keys para Integración Externa (`GET /maintenances/external/history/:plate`)
Enviar en el header HTTP `x-api-key`:
- `demo-key-partner-1`
- `demo-key-partner-2`

### Placas de Vehículos Sembrados
- `FLC-101` — Toyota Hilux (`AVAILABLE`, con mantenimiento `COMPLETED`)
- `FLC-102` — Ford Ranger (`AVAILABLE`)
- `FLC-201` — Chevrolet NHR (`IN_MAINTENANCE`, con mantenimiento `IN_PROGRESS`)
- `FLC-999` — Nissan Frontier (`INACTIVE`)

---

## 5. Documentación Interactiva (Swagger / OpenAPI)

Con la aplicación en ejecución, accede a:

- **Swagger UI:** http://localhost:3000/api/docs
- **Especificación OpenAPI JSON (para importar en Postman):** http://localhost:3000/api/docs-json

En el botón **Authorize** de Swagger puedes registrar:
1. **`bearer`**: El `accessToken` obtenido en `POST /auth/login`.
2. **`x-api-key`**: La llave `demo-key-partner-1` para probar el endpoint externo.

---

## 6. Ejecución de Pruebas y Generación de Dump SQL

```bash
# Pruebas unitarias (Jest)
npm run test

# Pruebas de humo End-to-End (Smoke Tests e2e)
npm run test:e2e

# Linter con chequeo de tipos
npm run lint

# Generar volcado completo de PostgreSQL (esquema + datos sembrados)
docker compose exec -T postgres pg_dump -U postgres -d fleetcore --clean > dump.sql
```
