#!/bin/sh
# Cria o banco de testes ao inicializar o Postgres de desenvolvimento.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE DATABASE vellor_test OWNER "$POSTGRES_USER";
EOSQL
