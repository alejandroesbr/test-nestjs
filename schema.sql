-- =============================================================================
-- FleetCore Database Schema (PostgreSQL DDL)
-- Orden topológico, idempotente, integridad referencial e invariantes de dominio
-- =============================================================================

-- =============================================================================
-- 1. Tipos de datos personalizados (Enums)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
    CREATE TYPE user_role_enum AS ENUM ('ADMIN', 'TECHNICIAN');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_status_enum') THEN
    CREATE TYPE vehicle_status_enum AS ENUM ('AVAILABLE', 'IN_MAINTENANCE', 'INACTIVE');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'maintenance_type_enum') THEN
    CREATE TYPE maintenance_type_enum AS ENUM ('PREVENTIVE', 'CORRECTIVE');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'maintenance_status_enum') THEN
    CREATE TYPE maintenance_status_enum AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
  END IF;
END
$$;

-- =============================================================================
-- 2. Entidades independientes (Nivel 0)
-- =============================================================================

-- Tabla: users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(150) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role user_role_enum NOT NULL DEFAULT 'TECHNICIAN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_users_email UNIQUE (email)
);

-- Tabla: workshops
CREATE TABLE IF NOT EXISTS workshops (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  address VARCHAR(255) NOT NULL,
  status BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla: vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  plate VARCHAR(20) NOT NULL,
  brand VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year INTEGER NOT NULL,
  mileage INTEGER NOT NULL DEFAULT 0,
  status vehicle_status_enum NOT NULL DEFAULT 'AVAILABLE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT uq_vehicles_plate UNIQUE (plate),
  CONSTRAINT chk_vehicles_mileage_non_negative CHECK (mileage >= 0),
  CONSTRAINT chk_vehicles_year_valid CHECK (year >= 1900)
);

-- =============================================================================
-- 3. Entidades dependientes (Nivel 1)
-- =============================================================================

-- Tabla: mechanics
CREATE TABLE IF NOT EXISTS mechanics (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL,
  specialty VARCHAR(120) NOT NULL,
  status BOOLEAN NOT NULL DEFAULT TRUE,
  user_id INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_mechanics_email UNIQUE (email),
  CONSTRAINT uq_mechanics_user_id UNIQUE (user_id),
  CONSTRAINT fk_mechanics_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

-- =============================================================================
-- 4. Agregados y transacciones compuestas (Nivel 2)
-- =============================================================================

-- Tabla: maintenances (Aggregate Root)
CREATE TABLE IF NOT EXISTS maintenances (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL,
  mechanic_id INTEGER NOT NULL,
  workshop_id INTEGER NOT NULL,
  type maintenance_type_enum NOT NULL DEFAULT 'PREVENTIVE',
  description TEXT NOT NULL,
  mileage INTEGER NOT NULL,
  scheduled_date TIMESTAMPTZ NOT NULL,
  status maintenance_status_enum NOT NULL DEFAULT 'SCHEDULED',
  work_done TEXT NULL,
  final_cost NUMERIC(12, 2) NULL,
  finished_at TIMESTAMPTZ NULL,
  final_mileage INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_maintenances_vehicle
    FOREIGN KEY (vehicle_id) REFERENCES vehicles (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT fk_maintenances_mechanic
    FOREIGN KEY (mechanic_id) REFERENCES mechanics (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT fk_maintenances_workshop
    FOREIGN KEY (workshop_id) REFERENCES workshops (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT chk_maintenances_mileage_non_negative
    CHECK (mileage >= 0),
  CONSTRAINT chk_maintenances_final_cost_non_negative
    CHECK (final_cost IS NULL OR final_cost >= 0),
  CONSTRAINT chk_maintenances_final_mileage_non_negative
    CHECK (final_mileage IS NULL OR final_mileage >= 0),
  CONSTRAINT chk_maintenances_mileage_progression
    CHECK (final_mileage IS NULL OR final_mileage >= mileage)
);

-- =============================================================================
-- 5. Índices estratégicos e índices parciales
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_mechanics_user_id
  ON mechanics (user_id);

CREATE INDEX IF NOT EXISTS idx_maintenances_vehicle_id
  ON maintenances (vehicle_id);

CREATE INDEX IF NOT EXISTS idx_maintenances_mechanic_id
  ON maintenances (mechanic_id);

CREATE INDEX IF NOT EXISTS idx_maintenances_workshop_id
  ON maintenances (workshop_id);

CREATE INDEX IF NOT EXISTS idx_maintenances_status
  ON maintenances (status);

CREATE INDEX IF NOT EXISTS idx_maintenances_mechanic_schedule
  ON maintenances (mechanic_id, scheduled_date)
  WHERE status IN ('SCHEDULED', 'IN_PROGRESS');

CREATE UNIQUE INDEX IF NOT EXISTS uq_maintenances_active_vehicle
  ON maintenances (vehicle_id)
  WHERE status IN ('SCHEDULED', 'IN_PROGRESS');
