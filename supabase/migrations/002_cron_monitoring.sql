-- Cron execution monitoring
CREATE TABLE cron_executions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_name text NOT NULL,
  domain_id text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running', -- running, success, failed, timeout
  keywords_processed int DEFAULT 0,
  keywords_failed int DEFAULT 0,
  supabase_rows_written int DEFAULT 0,
  error_message text,
  duration_ms int
);

CREATE INDEX idx_cron_exec_job_date ON cron_executions (job_name, started_at DESC);
CREATE INDEX idx_cron_exec_status ON cron_executions (status) WHERE status != 'success';
