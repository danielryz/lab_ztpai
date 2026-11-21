const { uniqueViolation } = require("../../db/memoryErrors");

// seed: [{ email, passwordHash, role }]
function createUsersRepository({ seed = [] } = {}) {
  const users = [];
  let nextId = 1;

  function insert({ email, passwordHash, role }) {
    // Odpowiednik UNIQUE(email) w bazie
    if (users.some(u => u.email === email)) throw uniqueViolation();
    const user = { id: nextId++, email, passwordHash, role, createdAt: new Date() };
    users.push(user);
    return user;
  }

  seed.forEach(insert);

  return {
    async findById(id) {
      return users.find(u => u.id === id) ?? null;
    },

    async findByEmail(email) {
      return users.find(u => u.email === email) ?? null;
    },

    async create(data) {
      return insert(data);
    }
  };
}

module.exports = { createUsersRepository };
