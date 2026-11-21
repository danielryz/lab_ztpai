function createAuditLogRepository({ seed = [] } = {}) {
  const entries = structuredClone(seed);
  let nextId = Math.max(0, ...entries.map(e => e.id)) + 1;

  return {
    async create({ eventType, payload, createdAt }) {
      const entry = { id: nextId++, eventType, payload: structuredClone(payload), createdAt: new Date(createdAt) };
      entries.push(entry);
      return entry;
    },

    async findAll({ eventType, page = 1, limit = 20 } = {}) {
      const filtered = entries
        .filter(e => !eventType || e.eventType === eventType)
        .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id);
      const offset = (page - 1) * limit;
      return { items: filtered.slice(offset, offset + limit), total: filtered.length };
    }
  };
}

module.exports = { createAuditLogRepository };
