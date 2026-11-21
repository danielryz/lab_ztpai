// Jedyne miejsce w aplikacji, które czyta process.env.
// Zmienne są walidowane schematem Zod - przy błędzie aplikacja nie startuje.
const { z } = require("zod");

const DURATION = /^\d+(ms|s|m|h|d)$/; // format akceptowany przez jsonwebtoken, np. 15m, 10s, 1h

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: "must be a postgres:// or postgresql:// URL" }),
  // knex = PostgreSQL (domyślnie), memory = repositories in-memory
  REPOSITORY: z.enum(["knex", "memory"]).default("knex"),

  JWT_SECRET: z.string().min(32, "must be at least 32 characters long"),
  JWT_EXPIRES_IN: z.string().regex(DURATION, "must look like 15m, 10s, 1h").default("15m"),
  BCRYPT_COST: z.coerce.number().int().min(10).max(15).default(12),

  // Tylko dla seeda - konto ADMIN nie da się utworzyć przez API
  SEED_ADMIN_EMAIL: z.email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(10).max(72).optional(),
  SEED_USER_PASSWORD: z.string().min(10).max(72).optional()
});

function loadConfig(env) {
  // Pusta zmienna (np. SEED_ADMIN_EMAIL= w docker-compose.yml) traktowana jak brak zmiennej
  const nonEmpty = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ""));
  const result = envSchema.safeParse(nonEmpty);

  if (!result.success) {
    const lines = result.error.issues.map(issue => {
      const message = issue.message.includes("received undefined") ? "is required (missing in .env)" : issue.message;
      return `  - ${issue.path.join(".")}: ${message}`;
    });
    throw new Error(`Invalid configuration (check your .env file):\n${lines.join("\n")}`);
  }

  const e = result.data;
  return Object.freeze({
    env: e.NODE_ENV,
    port: e.PORT,
    db: { url: e.DATABASE_URL, repository: e.REPOSITORY },
    jwt: { secret: e.JWT_SECRET, expiresIn: e.JWT_EXPIRES_IN },
    bcrypt: { cost: e.BCRYPT_COST },
    seed: { adminEmail: e.SEED_ADMIN_EMAIL?.toLowerCase(), adminPassword: e.SEED_ADMIN_PASSWORD, userPassword: e.SEED_USER_PASSWORD }
  });
}

try {
  process.loadEnvFile();
} catch {
  // brak pliku .env - zmienne mogą przyjść z zewnątrz (np. docker, CI)
}

let config;
try {
  config = loadConfig(process.env);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

module.exports = config;
module.exports.loadConfig = loadConfig;
