SELECT format('CREATE ROLE sampler WITH LOGIN PASSWORD %L NOBYPASSRLS', :'sampler_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sampler') \gexec

SELECT format('CREATE ROLE runner WITH LOGIN PASSWORD %L NOBYPASSRLS', :'runner_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'runner') \gexec

CREATE SCHEMA IF NOT EXISTS sales AUTHORIZATION sampler;
CREATE SCHEMA IF NOT EXISTS reports AUTHORIZATION sampler;

GRANT USAGE ON SCHEMA sales, reports TO runner;
ALTER DEFAULT PRIVILEGES FOR ROLE sampler
  GRANT SELECT, INSERT, UPDATE ON TABLES TO runner;

DO $$
DECLARE
  target_db text := current_database();
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO sampler, runner', target_db);
  EXECUTE format('GRANT CREATE ON DATABASE %I TO sampler', target_db);
END
$$;