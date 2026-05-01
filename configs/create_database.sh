#!/bin/bash
set -e

PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -c "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 \
  || PGPASSWORD="$DB_PASSWORD" psql \
       -h "$DB_HOST" \
       -p "$DB_PORT" \
       -U "$DB_USER" \
       -c "CREATE DATABASE \"$DB_NAME\";"

PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -c "SELECT 1 FROM pg_database WHERE datname = '$DB_TEST_NAME'" | grep -q 1 \
  || PGPASSWORD="$DB_PASSWORD" psql \
       -h "$DB_HOST" \
       -p "$DB_PORT" \
       -U "$DB_USER" \
       -c "CREATE DATABASE \"$DB_TEST_NAME\";"
