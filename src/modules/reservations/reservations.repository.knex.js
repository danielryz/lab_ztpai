// Jedyne miejsce, które zna tabelę "reservations" i jej kolumny.
// Rezerwacja zawsze jest zwracana z salą, budynkiem i właścicielem (3x JOIN - stała liczba zapytań, brak N+1).

// Whitelista sortowania: wartość z API -> kolumna w SQL (nazwa kolumny nigdy nie pochodzi od klienta)
const SORT_COLUMNS = {
  startTime: "r.start_time",
  createdAt: "r.created_at",
  participants: "r.participants"
};

// camelCase (service) -> snake_case (baza) dla update()
const UPDATABLE_COLUMNS = {
  status: "status",
  cancelledAt: "cancelled_at"
};

function toReservation(row) {
  if (!row) return null;
  return {
    id: row.id,
    roomId: row.room_id,
    room: {
      id: row.room_id,
      name: row.room_name,
      building: { id: row.building_id, name: row.building_name }
    },
    userId: row.user_id,
    user: { id: row.user_id, email: row.user_email },
    participants: row.participants,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at
  };
}

function createReservationsRepository(db) {
  function joined() {
    return db("reservations as r")
      .join("rooms as rm", "rm.id", "r.room_id")
      .join("buildings as b", "b.id", "rm.building_id")
      .join("users as u", "u.id", "r.user_id");
  }

  function selectColumns(qb) {
    return qb.select(
      "r.id", "r.room_id", "r.user_id", "r.participants", "r.start_time", "r.end_time",
      "r.status", "r.created_at", "r.cancelled_at",
      "rm.name as room_name", "rm.building_id", "b.name as building_name", "u.email as user_email"
    );
  }

  async function findById(id) {
    return toReservation(await selectColumns(joined()).where("r.id", id).first());
  }

  return {
    // Filtrowanie, sortowanie i pagination robi baza (WHERE / ORDER BY / LIMIT / OFFSET)
    // userId - filtr właściciela (dla USER-a dokłada go service, niezależnie od query)
    async findAll({ userId, roomId, buildingId, status, from, to, page = 1, limit = 20, sort = "startTime" } = {}) {
      const base = joined().modify(qb => {
        if (userId) qb.where("r.user_id", userId);
        if (roomId) qb.where("r.room_id", roomId);
        if (buildingId) qb.where("rm.building_id", buildingId);
        if (status) qb.where("r.status", status);
        // nakładanie się z [from, to): start < to AND end > from
        if (to) qb.where("r.start_time", "<", to);
        if (from) qb.where("r.end_time", ">", from);
      });

      const desc = sort.startsWith("-");
      const column = SORT_COLUMNS[desc ? sort.slice(1) : sort];

      const [rows, { count }] = await Promise.all([
        selectColumns(base.clone())
          .orderBy(column, desc ? "desc" : "asc")
          .orderBy("r.id", "asc") // tie-breaker - stabilna kolejność
          .limit(limit)
          .offset((page - 1) * limit),
        base.clone().count({ count: "*" }).first()
      ]);

      return { items: rows.map(toReservation), total: Number(count) };
    },

    findById,

    async findByRoomAndStatus(roomId, status) {
      const rows = await selectColumns(joined())
        .where({ "r.room_id": roomId, "r.status": status })
        .orderBy("r.start_time", "asc");
      return rows.map(toReservation);
    },

    async create({ roomId, userId, participants, startTime, endTime, status, createdAt }) {
      const [{ id }] = await db("reservations")
        .insert({
          room_id: roomId,
          user_id: userId,
          participants,
          start_time: startTime,
          end_time: endTime,
          status,
          created_at: createdAt
        })
        .returning("id");
      return findById(id);
    },

    async existsForRoom(roomId) {
      return Boolean(await db("reservations").where({ room_id: roomId }).first("id"));
    },

    async update(id, changes) {
      const row = {};
      for (const [key, column] of Object.entries(UPDATABLE_COLUMNS)) {
        if (key in changes) row[column] = changes[key];
      }
      await db("reservations").where({ id }).update(row);
      return findById(id);
    }
  };
}

module.exports = { createReservationsRepository };
