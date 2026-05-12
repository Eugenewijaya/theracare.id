import { pool } from "./index.js";

export async function ensureProductionSchema() {
  if (!process.env.DATABASE_URL) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS therapy_periods (
      id text PRIMARY KEY,
      child_id text NOT NULL REFERENCES children(id),
      therapy_program_id integer REFERENCES therapy_programs(id),
      program_id text REFERENCES programs(id),
      period_number integer NOT NULL DEFAULT 1,
      name text NOT NULL,
      status text NOT NULL DEFAULT 'active',
      start_date date NOT NULL,
      end_date date,
      total_sessions integer NOT NULL DEFAULT 0,
      completed_sessions integer NOT NULL DEFAULT 0,
      price_per_session integer NOT NULL DEFAULT 0,
      price_per_month integer NOT NULL DEFAULT 0,
      total_price integer NOT NULL DEFAULT 0,
      billing_mode text NOT NULL DEFAULT 'per_session',
      schedule_rules jsonb,
      goals jsonb,
      notes text,
      renewal_of text,
      final_report_id text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );

    ALTER TABLE therapy_sessions
      ADD COLUMN IF NOT EXISTS therapy_period_id text;

    ALTER TABLE reports
      ADD COLUMN IF NOT EXISTS therapy_period_id text;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'therapy_sessions_therapy_period_id_therapy_periods_id_fk'
      ) THEN
        ALTER TABLE therapy_sessions
          ADD CONSTRAINT therapy_sessions_therapy_period_id_therapy_periods_id_fk
          FOREIGN KEY (therapy_period_id) REFERENCES therapy_periods(id);
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'reports_therapy_period_id_therapy_periods_id_fk'
      ) THEN
        ALTER TABLE reports
          ADD CONSTRAINT reports_therapy_period_id_therapy_periods_id_fk
          FOREIGN KEY (therapy_period_id) REFERENCES therapy_periods(id);
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS therapy_periods_child_id_idx ON therapy_periods(child_id);
    CREATE INDEX IF NOT EXISTS therapy_periods_status_idx ON therapy_periods(status);
    CREATE INDEX IF NOT EXISTS therapy_periods_program_id_idx ON therapy_periods(program_id);
    CREATE INDEX IF NOT EXISTS therapy_sessions_therapy_period_id_idx ON therapy_sessions(therapy_period_id);
    CREATE INDEX IF NOT EXISTS reports_therapy_period_id_idx ON reports(therapy_period_id);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id text PRIMARY KEY,
      actor_user_id text REFERENCES "user"(id),
      actor_role text,
      action text NOT NULL,
      entity_type text NOT NULL,
      entity_id text,
      summary text NOT NULL,
      metadata jsonb,
      created_at timestamp NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS audit_logs_actor_user_id_idx ON audit_logs(actor_user_id);
  `);
}
