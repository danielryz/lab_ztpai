// Service publikuje event po sukcesie i NIE publikuje po błędzie.
// eventBus to szpieg (jest.fn) - efektem operacji jest wywołanie, więc sprawdzamy interakcję.
const { createReservationsService } = require("../../src/modules/reservations/reservations.service");
const { createMemoryUnitOfWork } = require("../../src/db/unitOfWork.memory");

const NOW = new Date("2026-12-01T08:00:00Z");
const owner = { id: 2, role: "USER" };
const admin = { id: 1, role: "ADMIN" };

function setup() {
  const { runInTransaction } = createMemoryUnitOfWork({
    usersSeed: [
      { email: "admin@example.com", passwordHash: "x", role: "ADMIN" },
      { email: "jan@example.com", passwordHash: "x", role: "USER" }
    ],
    buildingsSeed: [{ id: 1, name: "A", address: "ul. Testowa 1" }],
    roomsSeed: [{ id: 1, buildingId: 1, name: "101", capacity: 10 }],
    reservationsSeed: []
  });
  const eventBus = { publish: jest.fn(), subscribe: jest.fn() };
  const service = createReservationsService({ runInTransaction, eventBus, now: () => NOW });
  return { service, eventBus };
}

const body = { roomId: 1, participants: 4, startTime: "2026-12-02T10:00:00Z", endTime: "2026-12-02T11:00:00Z" };

describe("reservationsService - eventy", () => {
  test("po utworzeniu publikuje reservation.created z kompletnym payloadem", async () => {
    const { service, eventBus } = setup();

    const created = await service.createReservation(body, owner);

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledWith("reservation.created", {
      reservationId: created.id,
      roomId: 1,
      userId: owner.id,
      startTime: "2026-12-02T10:00:00.000Z",
      endTime: "2026-12-02T11:00:00.000Z"
    });
  });

  test("nieudana operacja (409 ROOM_ALREADY_BOOKED) nie publikuje eventu", async () => {
    const { service, eventBus } = setup();
    await service.createReservation(body, owner);
    eventBus.publish.mockClear();

    await expect(service.createReservation(body, owner)).rejects.toMatchObject({ code: "ROOM_ALREADY_BOOKED" });

    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  test("błąd walidacji (za długa rezerwacja) nie publikuje eventu", async () => {
    const { service, eventBus } = setup();

    await expect(service.createReservation({ ...body, endTime: "2026-12-02T19:00:00Z" }, owner))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  test("anulowanie przez ADMINa publikuje reservation.cancelled z cancelledBy, ponowne anulowanie - już nie", async () => {
    const { service, eventBus } = setup();
    const created = await service.createReservation(body, owner);
    eventBus.publish.mockClear();

    await service.cancelReservation(created.id, admin);
    await service.cancelReservation(created.id, admin); // idempotentne

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledWith("reservation.cancelled", {
      reservationId: created.id, roomId: 1, userId: owner.id, cancelledBy: admin.id
    });
  });
});
