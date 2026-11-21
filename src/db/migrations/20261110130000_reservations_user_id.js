// reservations.reserved_by (tekst) -> reservations.user_id (FK do users).
// Migracja działa na bazie Z DANYMI: dla każdej istniejącej wartości reserved_by
// powstaje (albo zostaje odnalezione) konto użytkownika i rezerwacje są do niego przypisywane.
//
// Kroki: 1) kolumna user_id NULL, 2) konta + UPDATE, 3) NOT NULL, 4) usunięcie reserved_by.
// Całość działa w jednej transakcji (Knex domyślnie opakowuje migrację w transakcję),
// więc błąd w połowie niczego nie zostawi.
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");

// "Piotr Wiśniewski" -> "piotr.wisniewski@example.com"
function emailFromName(name, fallbackId) {
  const local = name
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return `${local || `user${fallbackId}`}@example.com`;
}

exports.up = async function (knex) {
  await knex.schema.alterTable("reservations", table => {
    // RESTRICT - użytkownika z rezerwacjami nie da się usunąć (rezerwacje to historia)
    table.integer("user_id").nullable().references("id").inTable("users").onDelete("RESTRICT");
  });

  const names = await knex("reservations").distinct("reserved_by").orderBy("reserved_by");

  for (const [i, { reserved_by: name }] of names.entries()) {
    const email = emailFromName(name, i + 1);

    // Konto "historyczne" z losowym, nieznanym nikomu hasłem - nie da się na nie zalogować,
    // dopóki administrator nie nada hasła. Jeśli konto o takim emailu już istnieje - używamy go.
    const lockedHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
    await knex("users")
      .insert({ email, password_hash: lockedHash, role: "USER" })
      .onConflict("email")
      .ignore();

    const user = await knex("users").where({ email }).first("id");
    await knex("reservations").where({ reserved_by: name }).update({ user_id: user.id });
  }

  await knex.schema.alterTable("reservations", table => {
    table.integer("user_id").notNullable().alter();
    // Pod filtr "USER widzi tylko swoje rezerwacje"
    table.index(["user_id"], "reservations_user_id_idx");
    table.dropColumn("reserved_by");
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("reservations", table => {
    table.string("reserved_by", 100).nullable();
  });

  // Najlepsze, co da się odtworzyć: email właściciela zamiast imienia i nazwiska
  await knex.raw(`
    UPDATE reservations r
       SET reserved_by = u.email
      FROM users u
     WHERE u.id = r.user_id
  `);

  await knex.schema.alterTable("reservations", table => {
    table.string("reserved_by", 100).notNullable().alter();
    table.dropIndex(["user_id"], "reservations_user_id_idx");
    table.dropColumn("user_id");
  });
};
