const HOUR = 60 * 60 * 1000;

// Te same dane co seed bazy (rezerwacja 4 już się rozpoczęła)
function defaultReservations(startedAt = Date.now()) {
  return [
    {
      id: 1, roomId: 3, reservedBy: "Jan Kowalski", participants: 20,
      startTime: new Date("2026-11-10T10:00:00Z"), endTime: new Date("2026-11-10T12:00:00Z"),
      status: "CONFIRMED", createdAt: new Date("2026-10-27T08:00:00Z"), cancelledAt: null
    },
    {
      id: 2, roomId: 3, reservedBy: "Anna Nowak", participants: 12,
      startTime: new Date("2026-11-10T12:00:00Z"), endTime: new Date("2026-11-10T13:00:00Z"),
      status: "CONFIRMED", createdAt: new Date("2026-10-28T09:30:00Z"), cancelledAt: null
    },
    {
      id: 3, roomId: 1, reservedBy: "Piotr Wiśniewski", participants: 8,
      startTime: new Date("2026-11-12T09:00:00Z"), endTime: new Date("2026-11-12T10:30:00Z"),
      status: "CANCELLED", createdAt: new Date("2026-10-29T11:00:00Z"), cancelledAt: new Date("2026-10-30T15:00:00Z")
    },
    {
      id: 4, roomId: 4, reservedBy: "Seed - spotkanie w trakcie", participants: 5,
      startTime: new Date(startedAt - HOUR), endTime: new Date(startedAt + HOUR),
      status: "CONFIRMED", createdAt: new Date(startedAt - 24 * HOUR), cancelledAt: null
    },
    {
      id: 5, roomId: 5, reservedBy: "Maria Zielińska", participants: 6,
      startTime: new Date("2026-11-20T14:00:00Z"), endTime: new Date("2026-11-20T16:00:00Z"),
      status: "CONFIRMED", createdAt: new Date("2026-10-31T10:00:00Z"), cancelledAt: null
    }
  ];
}

const SORT_FIELDS = {
  startTime: r => new Date(r.startTime).getTime(),
  createdAt: r => new Date(r.createdAt).getTime(),
  participants: r => r.participants
};

// rooms - repository sal in-memory (do osadzenia sali i budynku w rezerwacji)
function createReservationsRepository({ seed = defaultReservations(), rooms } = {}) {
  const reservations = structuredClone(seed);

  // Licznik ID - tylko rośnie, więc nigdy nie powstanie duplikat
  let nextId = Math.max(0, ...reservations.map(r => r.id)) + 1;

  async function withRoom(r) {
    if (!r) return null;
    const room = await rooms?.findById(r.roomId);
    return {
      ...r,
      room: room ? { id: room.id, name: room.name, building: room.building } : { id: r.roomId }
    };
  }

  return {
    async findAll({ roomId, buildingId, status, from, to, page = 1, limit = 20, sort = "startTime" } = {}) {
      const all = await Promise.all(reservations.map(withRoom));
      const fromMs = from ? new Date(from).getTime() : null;
      const toMs = to ? new Date(to).getTime() : null;

      const filtered = all.filter(r =>
        (!roomId || r.roomId === roomId) &&
        (!buildingId || r.room.building?.id === buildingId) &&
        (!status || r.status === status) &&
        (toMs === null || new Date(r.startTime).getTime() < toMs) &&
        (fromMs === null || new Date(r.endTime).getTime() > fromMs)
      );

      const desc = sort.startsWith("-");
      const key = SORT_FIELDS[desc ? sort.slice(1) : sort];
      filtered.sort((a, b) => (key(a) - key(b)) * (desc ? -1 : 1) || a.id - b.id);

      const offset = (page - 1) * limit;
      return { items: filtered.slice(offset, offset + limit), total: filtered.length };
    },

    async findById(id) {
      return withRoom(reservations.find(r => r.id === id));
    },

    async findByRoomAndStatus(roomId, status) {
      return Promise.all(reservations.filter(r => r.roomId === roomId && r.status === status).map(withRoom));
    },

    async create(data) {
      const reservation = {
        id: nextId++,
        roomId: data.roomId,
        reservedBy: data.reservedBy,
        participants: data.participants,
        startTime: data.startTime,
        endTime: data.endTime,
        status: data.status,
        createdAt: data.createdAt,
        cancelledAt: null
      };
      reservations.push(reservation);
      return withRoom(reservation);
    },

    async update(id, changes) {
      const reservation = reservations.find(r => r.id === id);
      Object.assign(reservation, changes);
      return withRoom(reservation);
    }
  };
}

module.exports = { createReservationsRepository };
