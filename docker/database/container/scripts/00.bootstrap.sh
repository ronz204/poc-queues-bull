#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
bootstrap_sql="$script_dir/database/00.bootstrap.sql"

run_psql() {
  psql -v ON_ERROR_STOP=1 \
    --username "$POSTGRES_USER" \
    -v sampler_password="$SAMPLER_PASSWORD" \
    -v runner_password="$RUNNER_PASSWORD" \
    "$@"
}

run_psql --dbname "$POSTGRES_DB" -v test_db="$POSTGRES_TEST" <<-'SQL'
  SELECT format('CREATE DATABASE %I', :'test_db')
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'test_db')\gexec
SQL

for db in "$POSTGRES_DB" "$POSTGRES_TEST"; do
  run_psql --dbname "$db" --file "$bootstrap_sql"
done