# bun-postgres-docker

Dump a Postgres database from Supabase and restore it to Railway, using `pg_dump` / `pg_restore` from a Bun-based Docker container.

## Requirements

- Docker, or Bun 1.3+ with `postgresql-client-17` installed locally.

## Configuration

Copy `.env.example` to `.env` and fill in the values:

```sh
cp .env.example .env
```

| Variable            | Required | Default      |
| ------------------- | -------- | ------------ |
| `SUPABASE_HOST`     | yes      | —            |
| `SUPABASE_USER`     | yes      | —            |
| `SUPABASE_PASSWORD` | yes      | —            |
| `SUPABASE_DB`       | yes      | —            |
| `RAILWAY_HOST`      | yes      | —            |
| `RAILWAY_PASSWORD`  | yes      | —            |
| `RAILWAY_PORT`      | no       | `5432`       |
| `RAILWAY_USER`      | no       | `postgres`   |
| `RAILWAY_DB`        | no       | `railway`    |

## Usage

### With Docker

```sh
docker build -t bun-postgres-docker .
docker run --rm --env-file .env bun-postgres-docker
```

### Locally

```sh
bun install
bun run start
```

## What it does

1. Runs `pg_dump` against Supabase for the `public` and `drizzle` schemas (custom format, no owner/ACL) into `prod_snapshot.dump`.
2. Runs `pg_restore --clean --if-exists` against Railway to apply the dump.
3. Creates `public.f_unaccent(text)`, an `IMMUTABLE` wrapper around `extensions.unaccent` so it can be used in functional indexes (e.g. `CREATE INDEX ON formation (f_unaccent(lower(title)))`).
