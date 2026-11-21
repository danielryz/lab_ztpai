// Tabela users - konta do logowania (zadanie 04)

exports.up = async function (knex) {
  await knex.schema.createTable("users", table => {
    table.increments("id").primary();
    // UNIQUE chroni przed duplikatem także przy równoległych rejestracjach (23505 -> 409 EMAIL_TAKEN)
    table.string("email", 254).notNullable().unique();
    // Tylko hash bcrypt (60 znaków) - hasło nie jest przechowywane w żadnej odwracalnej postaci
    table.string("password_hash", 60).notNullable();
    table.string("role", 20).notNullable().defaultTo("USER");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('USER', 'ADMIN'))`);
  // Email normalizujemy w API, baza pilnuje tego samego (Jan@x.pl i jan@x.pl nie mogą istnieć obok siebie)
  await knex.raw(`ALTER TABLE users ADD CONSTRAINT users_email_lowercase_check CHECK (email = lower(email))`);
};

exports.down = async function (knex) {
  await knex.schema.dropTable("users");
};
