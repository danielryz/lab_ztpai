const { z } = require("zod");

// Normalizacja przed walidacją: " Jan.Kowalski@Example.com " -> "jan.kowalski@example.com"
const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

// bcrypt bierze pod uwagę tylko pierwsze 72 BAJTY - pilnujemy też bajtów (polskie znaki to 2 bajty)
const password = z.string()
  .min(10)
  .max(72)
  .refine(p => Buffer.byteLength(p, "utf8") <= 72, "Password must be at most 72 bytes");

// .strict() - pole "role" (lub każde inne nieznane) -> 400
const registerBody = z.object({ email, password }).strict();

// Przy logowaniu nie zdradzamy reguł hasła - wystarczy niepusty string
const loginBody = z.object({
  email: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1)
}).strict();

module.exports = { registerBody, loginBody };
