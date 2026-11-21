const { NotFoundError, ConflictError, ValidationError, ForbiddenError } = require("../../errors/AppError");
const { ROLES } = require("../users/roles");
const { noopEventBus, EVENTS } = require("../../events/eventBus");

const MINUTE = 60 * 1000;
const MIN_DURATION_MS = 15 * MINUTE;
const MAX_DURATION_MS = 8 * 60 * MINUTE;

const ALLOWED_TRANSITIONS = {
  CONFIRMED: ["CANCELLED"],
  CANCELLED: [] // stan końcowy
};

// Przedziały półotwarte [start, end): rezerwacje stykające się (10:00-12:00 i 12:00-13:00) NIE nakładają się
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function timeRangeError(field, message) {
  return new ValidationError([{ location: "body", field, message }], "Invalid reservation time range");
}

const isAdmin = currentUser => currentUser.role === ROLES.ADMIN;

// Ownership: właściciel albo ADMIN. Obcy USER dostaje 404 - rezerwacje są prywatne,
// nie zdradzamy nawet, że rezerwacja o takim ID istnieje.
function assertCanAccess(reservation, currentUser) {
  if (!reservation) throw new NotFoundError("Reservation");
  if (!isAdmin(currentUser) && reservation.userId !== currentUser.id) {
    throw new NotFoundError("Reservation");
  }
}

// Repositories przychodzą przez runInTransaction (Unit of Work) - service nie zna Knexa.
// currentUser = { id, role } (z tokenu, ustawiony przez authenticate) - service sam pilnuje uprawnień.
// eventBus - eventy publikujemy dopiero PO zatwierdzeniu transakcji (await runInTransaction kończy się po COMMIT).
// Nieudana operacja (wyjątek -> ROLLBACK) nie dochodzi do publish, więc nie publikuje eventu.
function createReservationsService({ runInTransaction, eventBus = noopEventBus, now = () => new Date() }) {
  async function createReservation(input, currentUser) {
    const created = await runInTransaction(async ({ roomsRepository, reservationsRepository }) => {
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
        // Właściciel wyłącznie z tokenu - body nie może go ustawić (userId/reservedBy -> 400 w schemacie)
        userId: currentUser.id,
        participants: input.participants,
        startTime: new Date(start),
        endTime: new Date(end),
        status: "CONFIRMED",
        createdAt: now()
      });
    });

    // Tu transakcja jest już zatwierdzona (COMMIT)
    eventBus.publish(EVENTS.RESERVATION_CREATED, {
      reservationId: created.id,
      roomId: created.roomId,
      userId: created.userId,
      startTime: new Date(created.startTime).toISOString(),
      endTime: new Date(created.endTime).toISOString()
    });

    return created;
  }

  async function cancelReservation(id, currentUser) {
    let changed = false;

    const result = await runInTransaction(async ({ reservationsRepository }) => {
      const reservation = await reservationsRepository.findById(id);
      assertCanAccess(reservation, currentUser);

      const target = "CANCELLED";

      // Idempotentne ponowne anulowanie - bez zmian, bez eventu
      if (reservation.status === target) return reservation;

      if (!ALLOWED_TRANSITIONS[reservation.status].includes(target)) {
        throw new ConflictError(
          `Cannot change status from ${reservation.status} to ${target}`,
          "INVALID_STATUS_TRANSITION"
        );
      }

      // Reguła obowiązuje także ADMINa
      if (new Date(reservation.startTime).getTime() <= now().getTime()) {
        throw new ConflictError(
          "Reservation has already started and cannot be cancelled",
          "RESERVATION_ALREADY_STARTED"
        );
      }

      changed = true;
      return reservationsRepository.update(id, { status: target, cancelledAt: now() });
    });

    if (changed) {
      eventBus.publish(EVENTS.RESERVATION_CANCELLED, {
        reservationId: result.id,
        roomId: result.roomId,
        userId: result.userId,
        cancelledBy: currentUser.id
      });
    }

    return result;
  }

  async function getReservation(id, currentUser) {
    return runInTransaction(async ({ reservationsRepository }) => {
      const reservation = await reservationsRepository.findById(id);
      assertCanAccess(reservation, currentUser);
      return reservation;
    });
  }

  async function listReservations(query, currentUser) {
    const filters = { ...query };

    if (!isAdmin(currentUser)) {
      // Filtr ?userId= jest tylko dla ADMINa. USER -> 403 zamiast cichego ignorowania:
      // klient od razu widzi, że prosi o coś, do czego nie ma prawa, a nie dostaje "po cichu" innych danych.
      if (query.userId !== undefined) {
        throw new ForbiddenError("Filter userId is available only for ADMIN");
      }
      // USER widzi tylko swoje rezerwacje - filtr dokłada backend, niezależnie od query
      filters.userId = currentUser.id;
    }

    return runInTransaction(async ({ reservationsRepository }) => {
      const { items, total } = await reservationsRepository.findAll(filters);
      return {
        items,
        meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) }
      };
    });
  }

  return { createReservation, cancelReservation, getReservation, listReservations };
}

module.exports = { createReservationsService, ALLOWED_TRANSITIONS, overlaps };
