const supabaseHost = process.env.SUPABASE_HOST || "";
const supabaseUser = process.env.SUPABASE_USER || "";
const supabasePassword = process.env.SUPABASE_PASSWORD || "";
const supabaseDb = process.env.SUPABASE_DB || "";

const railwayHost = process.env.RAILWAY_HOST || "";
const railwayPort = process.env.RAILWAY_PORT || "5432";
const railwayUser = process.env.RAILWAY_USER || "postgres";
const railwayPassword = process.env.RAILWAY_PASSWORD || "";
const railwayDb = process.env.RAILWAY_DB || "railway";

const DUMP_FILE = "prod_snapshot.dump";
const skipDump = process.argv.includes("--skip-dump") || process.env.SKIP_DUMP === "1";

async function run(
  cmd: string,
  args: string[],
  env: Record<string, string> = {}
) {
  console.error(`\n> ${cmd} ${args.join(" ")}`);
  const proc = Bun.spawn([cmd, ...args], {
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      ...env,
    } as Record<string, string>,
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(
      `Command failed (exit ${exitCode}): ${cmd} ${args.join(" ")}`
    );
  }
}

const required: Record<string, string> = {
  RAILWAY_HOST: railwayHost,
  RAILWAY_PASSWORD: railwayPassword,
  ...(skipDump
    ? {}
    : {
        SUPABASE_HOST: supabaseHost,
        SUPABASE_USER: supabaseUser,
        SUPABASE_PASSWORD: supabasePassword,
        SUPABASE_DB: supabaseDb,
      }),
};

for (const [key, val] of Object.entries(required)) {
  if (!val) {
    console.error(`❌ Missing env var: ${key}`);
    process.exit(1);
  }
}

if (skipDump) {
  const dumpExists = await Bun.file(DUMP_FILE).exists();
  if (!dumpExists) {
    console.error(`❌ --skip-dump set but ${DUMP_FILE} not found`);
    process.exit(1);
  }
  console.error(`⏭  Skipping dump, reusing ${DUMP_FILE}`);
} else {
  console.error("⏳ Dumping from Supabase...");
  await run(
    "pg_dump",
    [
      "-h", supabaseHost,
      "-p", "5432",
      "-U", supabaseUser,
      "-d", supabaseDb,
      "--format=custom",
      "--no-owner",
      "--no-acl",
      "--schema=public",
      "--schema=drizzle",
      "--exclude-table=public.__*",
      "--file", DUMP_FILE,
    ],
    { PGPASSWORD: supabasePassword }
  );
  console.error("✅ Dump complete.");
}

console.error("⏳ Resetting Railway schemas...");
await run(
  "psql",
  [
    "-h", railwayHost,
    "-p", railwayPort,
    "-U", railwayUser,
    "-d", railwayDb,
    "-v", "ON_ERROR_STOP=1",
    "-c", "DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA IF NOT EXISTS extensions; CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions; CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;",
  ],
  { PGPASSWORD: railwayPassword }
);

console.error("⏳ Restoring to Railway...");
await run(
  "pg_restore",
  [
    "--no-owner",
    "--no-acl",
    "-h", railwayHost,
    "-p", railwayPort,
    "-U", railwayUser,
    "-d", railwayDb,
    DUMP_FILE,
  ],
  { PGPASSWORD: railwayPassword }
);
console.error("✅ Restore complete!");

console.error("⏳ Creating f_unaccent wrapper...");
await run(
  "psql",
  [
    "-h", railwayHost,
    "-p", railwayPort,
    "-U", railwayUser,
    "-d", railwayDb,
    "-v", "ON_ERROR_STOP=1",
    "-c",
    "CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$ SELECT extensions.unaccent($1) $$;",
  ],
  { PGPASSWORD: railwayPassword }
);
console.error("✅ f_unaccent ready.");
