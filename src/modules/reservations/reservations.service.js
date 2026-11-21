const { NotFoundError, ConflictError, ValidationError } = require("../../errors/AppError");

const MINUTE = 60 * 1000;
const MIN_DURATION_MS = 15 * MINUTE;
const MAX_DURATION_MS = 8 * 60 * MINUTE;

const ALLOWED_TRANSITIONS = {
  CONFIRMED: ["CANCELLED"],
  CANCELLED: [] // stan końcowy
};

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function timeRangeError(field, message) {
  return new ValidationError([{ location: "body", field, message }], "Invalid reservation time range");
}

// Repositories przychodzą przez runInTransaction (Unit of Work) - service nie zna Knexa
function createReservationsService({ runInTransaction, now = () => new Date() }) {
  async function createReservation(input) {
    return runInTransaction(async ({ roomsRepository, reservationsRepository }) => {
      const room = await roomsRepository.findById(input.roomId);
      if (!room) throw new NotFoundError("Room");

      const start = new Date(input.startTime).getTime();
      const end = new Date(input.endTime).getTime();
      const duration = end - start;

      if (end <= start) {
        throw timeRangeError("endTime", "endTime must be later than startTime");
      }
      if (duration < MIN_DURATION_MS) {
        throw timeRangeError("endTime", "Reservation must last at least 15 minutes");
      }
      if (duration > MAX_DURATION_MS) {
        throw timeRangeError("endTime", "Reservation must not last longer than 8 hours");
      }
      if (start < now().getTime()) {
        throw timeRangeError("startTime", "startTime cannot be in the past");
      }

      if (input.participants > room.capacity) {
        throw new ConflictError(
          `Room capacity exceeded (capacity: ${room.capacity}, participants: ${input.participants})`,
          "ROOM_CAPACITY_EXCEEDED"
        );
      }

      // Blokada wiersza sali (SELECT ... FOR UPDATE) do końca transakcji. Reguła "brak nakładających się
      // rezerwacji" dotyczy sali, więc równoległe requesty o tę samą salę czekają tu w kolejce.
      await roomsRepository.lockById(room.id);

      const active = await reservationsRepository.findByRoomAndStatus(room.id, "CONFIRMED");
      const conflict = active.find(r =>
        overlaps(start, end, new Date(r.startTime).getTime(), new Date(r.endTime).getTime())
      );
      if (conflict) {
        throw new ConflictError(
          `Room is already booked in this time range (conflicts with reservation ${conflict.id})`,
          "ROOM_ALREADY_BOOKED"
        );
      }

      return reservationsRepository.create({
        roomId: room.id,
        reservedBy: input.reservedBy,
        participants: input.participants,
        startTime: new Date(start),
        endTime: new Date(end),
        status: "CONFIRMED",
        createdAt: now(),
        internalNote: "created via API v2"
      });
    });
  }

  async function cancelReservation(id) {
    return runInTransaction(async ({ reservationsRepository }) => {
      const reservation = await reservationsRepository.findById(id);
      if (!reservation) throw new NotFoundError("Reservation");

      const target = "CANCELLED";

      if (reservation.status === target) return reservation;

      if (!ALLOWED_TRANSITIONS[reservation.status].includes(target)) {
        throw new ConflictError(
          `Cannot change status from ${reservation.status} to ${target}`,
          "INVALID_STATUS_TRANSITION"
        );
      }

      if (new Date(reservation.startTime).getTime() <= now().getTime()) {
        throw new ConflictError(
          "Reservation has already started and cannot be cancelled",
          "RESERVATION_ALREADY_STARTED"
        );
      }

      return reservationsRepository.update(id, { status: target, cancelledAt: now() });
    });
  }

  async function getReservation(id) {
    return runInTransaction(async ({ reservationsRepository }) => {
      const reservation = await reservationsRepository.findById(id);
      if (!reservation) throw new NotFoundError("Reservation");
      return reservation;
    });
  }

  async function listReservations(query) {
    return runInTransaction(async ({ reservationsRepository }) => {
      const { items, total } = await reservationsRepository.findAll(query);
      return {
        items,
        meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) }
      };
    });
  }

  return { createReservation, cancelReservation, getReservation, listReservations };
}

module.exports = { createReservationsService, ALLOWED_TRANSITIONS, overlaps };
