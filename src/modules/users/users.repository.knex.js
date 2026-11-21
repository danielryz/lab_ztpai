// Jedyne miejsce, które zna tabelę "users" i jej kolumny
function toUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: row.created_at
  };
}

function createUsersRepository(db) {
  return {
    async findById(id) {
      return toUser(await db("users").where({ id }).first());
    },

    async findByEmail(email) {
      return toUser(await db("users").where({ email }).first());
    },

    // Duplikat emaila -> PostgreSQL rzuca 23505 (unique_violation), mapowane w service
    async create({ email, passwordHash, role }) {
      const [row] = await db("users")
        .insert({ email, password_hash: passwordHash, role })
        .returning("*");
      return toUser(row);
    }
  };
}

module.exports = { createUsersRepository };
