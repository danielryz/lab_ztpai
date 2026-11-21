// Unit testy reguł biznesowych rezerwacji.
// Zależności podmienione: repositories in-memory (fake) + zamrożony czas (now). Brak bazy danych.
const { createReservationsService } = require("../../src/modules/reservations/reservations.service");
const { createMemoryUnitOfWork } = require("../../src/db/unitOfWork.memory");

const NOW = new Date("2026-12-01T08:00:00Z");
const at = hhmm => new Date(`2026-12-02T${hhmm}:00Z`); // wszystkie przedziały w testach są 2 grudnia

const admin = { id: 1, role: "ADMIN" };
const owner = { id: 2, role: "USER" };
const otherUser = { id: 3, role: "USER" };

const USERS = [
  { email: "admin@example.com", passwordHash: "x", role: "ADMIN" }, // id 1
  { email: "jan@example.com", passwordHash: "x", role: "USER" },    // id 2
  { email: "anna@example.com", passwordHash: "x", role: "USER" }    // id 3
];
const BUILDINGS = [{ id: 1, name: "Budynek A", address: "ul. Testowa 1" }];
const ROOMS = [
  { id: 1, buildingId: 1, name: "101", capacity: 10 },
  { id: 2, buildingId: 1, name: "102", capacity: 10 }
];

function reservation(id, { roomId = 1, userId = owner.id, start = "10:00", end = "12:00", status = "CONFIRMED", startTime, endTime } = {}) {
  return {
    id, roomId, userId, participants: 5,
    startTime: startTime ?? at(start),
    endTime: endTime ?? at(end),
    status,
    createdAt: new Date("2026-11-30T10:00:00Z"),
    cancelledAt: status === "CANCELLED" ? new Date("2026-11-30T12:00:00Z") : null
  };
}

// Każdy test buduje WŁASNY stan (nowe repositories) - testy nie zależą od kolejności
function setup({ reservations = [], clock = { now: NOW } } = {}) {
  const { runInTransaction } = createMemoryUnitOfWork({
    usersSeed: USERS, buildingsSeed: BUILDINGS, roomsSeed: ROOMS, reservationsSeed: reservations
  });
  const eventBus = { publish: jest.fn(), subscribe: jest.fn() };
  const service = createReservationsService({ runInTransaction, eventBus, now: () => clock.now });
  return { service, eventBus, clock };
}

const input = (start, end, { roomId = 1, participants = 5 } = {}) =>
  ({ roomId, participants, startTime: at(start).toISOString(), endTime: at(end).toISOString() });

describe("reservationsService.createReservation - nakładanie się", () => {
  test("tworzy rezerwację CONFIRMED, właścicielem jest zalogowany użytkownik", async () => {
    const { service } = setup();

    const created = await service.createReservation(input("10:00", "12:00"), owner);

    expect(created).toMatchObject({ status: "CONFIRMED", userId: owner.id, roomId: 1, cancelledAt: null });
  });

  test.each([
    ["częściowe - zaczyna się przed, kończy w trakcie", "09:00", "11:00"],
    ["częściowe - zaczyna się w trakcie, kończy po", "11:00", "13:00"],
    ["zawieranie - nowa obejmuje istniejącą", "09:00", "13:00"],
    ["zawieranie - nowa w środku istniejącej", "10:30", "11:30"],
    ["identyczny przedział", "10:00", "12:00"]
  ])("odrzuca nakładanie: %s (%s-%s)", async (_, start, end) => {
    const { service } = setup({ reservations: [reservation(1)] }); // istniejąca: 10:00-12:00

    await expect(service.createReservation(input(start, end), otherUser))
      .rejects.toMatchObject({ statusCode: 409, code: "ROOM_ALREADY_BOOKED" });
  });

  test.each([
    ["kończy się dokładnie, gdy istniejąca się zaczyna", "08:00", "10:00"],
    ["zaczyna się dokładnie, gdy istniejąca się kończy", "12:00", "13:00"]
  ])("pozwala na przedziały stykające się: %s (%s-%s)", async (_, start, end) => {
    const { service } = setup({ reservations: [reservation(1)] });

    await expect(service.createReservation(input(start, end), otherUser))
      .resolves.toMatchObject({ status: "CONFIRMED" });
  });

  test("pozwala na ten sam przedział w innej sali", async () => {
    const { service } = setup({ reservations: [reservation(1, { roomId: 1 })] });

    await expect(service.createReservation(input("10:00", "12:00", { roomId: 2 }), otherUser))
      .resolves.toMatchObject({ roomId: 2, status: "CONFIRMED" });
  });

  test("rezerwacja CANCELLED nie blokuje przedziału", async () => {
    const { service } = setup({ reservations: [reservation(1, { status: "CANCELLED" })] });

    await expect(service.createReservation(input("10:00", "12:00"), otherUser))
      .resolves.toMatchObject({ status: "CONFIRMED" });
  });
});

describe("reservationsService.createReservation - pojemność i czas trwania", () => {
  test("participants == capacity jest dozwolone", async () => {
    const { service } = setup();

    await expect(service.createReservation(input("10:00", "11:00", { participants: 10 }), owner))
      .resolves.toMatchObject({ participants: 10 });
  });

  test("participants == capacity + 1 jest odrzucone", async () => {
    const { service } = setup();

    await expect(service.createReservation(input("10:00", "11:00", { participants: 11 }), owner))
      .rejects.toMatchObject({ statusCode: 409, code: "ROOM_CAPACITY_EXCEEDED" });
  });

  test.each([
    ["dokładnie 15 min", "10:00", "10:15"],
    ["dokładnie 8 h", "09:00", "17:00"]
  ])("pozwala na czas trwania %s", async (_, start, end) => {
    const { service } = setup();

    await expect(service.createReservation(input(start, end), owner)).resolves.toMatchObject({ status: "CONFIRMED" });
  });

  test.each([
    ["14 min", "10:00", "10:14"],
    ["8 h 1 min", "09:00", "17:01"]
  ])("odrzuca czas trwania %s", async (_, start, end) => {
    const { service } = setup();

    await expect(service.createReservation(input(start, end), owner)).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      details: [expect.objectContaining({ field: "endTime" })]
    });
  });

  test("odrzuca rezerwację rozpoczynającą się w przeszłości (względem wstrzykniętego czasu)", async () => {
    const { service } = setup({ clock: { now: at("10:30") } });

    await expect(service.createReservation(input("10:00", "11:00"), owner)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      details: [expect.objectContaining({ field: "startTime" })]
    });
  });

  test("404 dla nieistniejącej sali", async () => {
    const { service } = setup();

    await expect(service.createReservation(input("10:00", "11:00", { roomId: 999 }), owner))
      .rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
  });
});

describe("reservationsService.cancelReservation", () => {
  test("właściciel anuluje rezerwację - status CANCELLED, cancelledAt = now", async () => {
    const { service } = setup({ reservations: [reservation(1)] });

    await expect(service.cancelReservation(1, owner))
      .resolves.toMatchObject({ status: "CANCELLED", cancelledAt: NOW });
  });

  test("odrzuca anulowanie rozpoczętej rezerwacji", async () => {
    const { service } = setup({
      reservations: [reservation(1, {
        startTime: new Date(NOW.getTime() - 30 * 60_000),
        endTime: new Date(NOW.getTime() + 30 * 60_000)
      })]
    });

    await expect(service.cancelReservation(1, owner))
      .rejects.toMatchObject({ statusCode: 409, code: "RESERVATION_ALREADY_STARTED" });
  });

  test("podwójne anulowanie jest idempotentne - cancelledAt się nie zmienia", async () => {
    const { service, clock } = setup({ reservations: [reservation(1)] });
    const first = await service.cancelReservation(1, owner);

    clock.now = new Date(NOW.getTime() + 60 * 60_000); // godzinę później
    const second = await service.cancelReservation(1, owner);

    expect(second.status).toBe("CANCELLED");
    expect(second.cancelledAt).toEqual(first.cancelledAt);
    expect(second.cancelledAt).toEqual(NOW);
  });

  test("obcy USER nie może anulować cudzej rezerwacji (404, rezerwacja bez zmian)", async () => {
    const { service } = setup({ reservations: [reservation(1)] });

    await expect(service.cancelReservation(1, otherUser)).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
    await expect(service.getReservation(1, owner)).resolves.toMatchObject({ status: "CONFIRMED" });
  });

  test("ADMIN może anulować cudzą rezerwację", async () => {
    const { service } = setup({ reservations: [reservation(1)] });

    await expect(service.cancelReservation(1, admin)).resolves.toMatchObject({ status: "CANCELLED", userId: owner.id });
  });
});

describe("reservationsService.getReservation - ownership", () => {
  test("obcy USER dostaje 404, właściciel i ADMIN widzą rezerwację", async () => {
    const { service } = setup({ reservations: [reservation(1)] });

    await expect(service.getReservation(1, otherUser)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(service.getReservation(1, owner)).resolves.toMatchObject({ id: 1 });
    await expect(service.getReservation(1, admin)).resolves.toMatchObject({ id: 1 });
  });
});
