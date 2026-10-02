#!/bin/bash
set -e

# Creates one database per microservice on first container start.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE DATABASE users_db;
  CREATE DATABASE orders_db;
  CREATE DATABASE auth_db;
EOSQL
