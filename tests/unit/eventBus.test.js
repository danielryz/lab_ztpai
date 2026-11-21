const { createEventBus } = require("../../src/events/eventBus");

// Czeka, aż wykonają się handlery zaplanowane przez Promise.resolve().then(...)
const flush = () => new Promise(resolve => setImmediate(resolve));

describe("eventBus", () => {
  test("dostarcza event z nazwą, czasem i payloadem do wszystkich subskrybentów", async () => {
    const bus = createEventBus();
    const a = jest.fn();
    const b = jest.fn();
    bus.subscribe("reservation.created", a);
    bus.subscribe("reservation.created", b);

    bus.publish("reservation.created", { reservationId: 7 });
    await flush();

    const expected = expect.objectContaining({ name: "reservation.created", payload: { reservationId: 7 }, occurredAt: expect.any(String) });
    expect(a).toHaveBeenCalledWith(expected);
    expect(b).toHaveBeenCalledWith(expected);
  });

  test("błąd listenera (sync i async) nie wychodzi z publish i nie blokuje innych listenerów", async () => {
    const logger = { error: jest.fn() };
    const bus = createEventBus({ logger });
    const healthy = jest.fn();
    bus.subscribe("x", () => { throw new Error("sync boom"); });
    bus.subscribe("x", async () => { throw new Error("async boom"); });
    bus.subscribe("x", healthy);

    expect(() => bus.publish("x", {})).not.toThrow();
    await flush();

    expect(healthy).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(2);
  });
});
