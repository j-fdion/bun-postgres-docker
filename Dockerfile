FROM oven/bun:1.3.0

# Install PostgreSQL 17 client tools (matches Supabase's PG version)
RUN apt-get update && \
    apt-get install -y curl ca-certificates gnupg lsb-release && \
    install -d /usr/share/postgresql-common/pgdg && \
    curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
      https://www.postgresql.org/media/keys/ACCC4CF8.asc && \
    echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
      https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list && \
    apt-get update && \
    apt-get install -y postgresql-client-17 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install
COPY . .

CMD ["bun", "run", "index.tsx"]
