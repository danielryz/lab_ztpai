const HOUR = 60 * 60 * 1000;

// Seed: rezerwacja, która JUŻ SIĘ ROZPOCZĘŁA (trwa w momencie startu servera).
// Była poprawna przy tworzeniu, ale czas minął - do testu RESERVATION_ALREADY_STARTED.
function defaultReservations(startedAt = Date.now()) {
  return [
    {
      id: 1,
      roomId: 4,
      reservedBy: "Seed - spotkanie w trakcie",
      participants: 5,
      startTime: new Date(startedAt - HOUR),
      endTime: new Date(startedAt + HOUR),
      status: "CONFIRMED",
      createdAt: new Date(startedAt - 24 * HOUR),
      cancelledAt: null,
      internalNote: "seed data"
    }
  ];
}

// Jedyne miejsce, w którym istnieje tablica z rezerwacjami
function createReservationsRepository(seed = defaultReservations()) {
  const reservations = structuredClone(seed);

  // Licznik ID - tylko rośnie, więc nigdy nie powstanie duplikat (zamiast array.length + 1)
  let nextId = Math.max(0, ...reservations.map(r => r.id)) + 1;

  return {
    async findAll({ roomId } = {}) {
      return reservations.filter(r => roomId === undefined || r.roomId === roomId);
    },

    async findById(id) {
      return reservations.find(r => r.id === id) ?? null;
    },

    async findByRoomAndStatus(roomId, status) {
      return reservations.filter(r => r.roomId === roomId && r.status === status);
    },

    async create(data) {
      const reservation = { id: nextId++, cancelledAt: null, ...data };
      reservations.push(reservation);
      return reservation;
    },

    async update(id, changes) {
      const reservation = reservations.find(r => r.id === id);
      Object.assign(reservation, changes);
      return reservation;
    }
  };
}

module.exports = { createReservationsRepository };
