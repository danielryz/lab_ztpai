// Eventy + audit log end-to-end: prawdziwy event bus z listenerem zapisującym do tabeli audit_log
const request = require("supertest");
const config = require("../../src/config");
const db = require("../../src/db/knex");
const { createApp } = require("../../src/app");
const { createKnexUnitOfWork } = require("../../src/db/unitOfWork.knex");
const { createEventBus } = require("../../src/events/eventBus");
const { registerAuditListeners } = require("../../src/events/auditListeners");
const { ensureTestDatabase, resetDatabase, ADMIN } = require("./testDb");

const { runInTransaction } = createKnexUnitOfWork(db);
const eventBus = createEventBus();
registerAuditListeners(eventBus, { runInTransaction });
const app = createApp({ config, runInTransaction, eventBus });

// Listenery działają asynchronicznie (po wysłaniu odpowiedzi) - czekamy, aż wpisy pojawią się w bazie
async function waitForAuditRows(expected, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { n } = await db("audit_log").count({ n: "*" }).first();
    if (Number(n) >= expected || Date.now() > deadline) return Number(n);
    await new Promise(r => setTimeout(r, 25));
  }
}

const login = async (email, password) =>
  (await request(app).post("/api/auth/login").send({ email, password }).expect(200)).body.accessToken;

beforeAll(async () => {
  await ensureTestDatabase();
  await db.migrate.latest();
});
beforeEach(() => resetDatabase(db));
afterAll(() => db.destroy());

test("scenariusz: utworzenie -> nieudana kolizja -> anulowanie przez ADMINa -> ponowne anulowanie", async () => {
  await request(app).post("/api/auth/register").send({ email: "jan@example.com", password: "password-123456" }).expect(201);
  const jan = await login("jan@example.com", "password-123456");
  const admin = await login(ADMIN.email, ADMIN.password);
  const body = { roomId: 1, participants: 3, startTime: "2030-03-01T10:00:00Z", endTime: "2030-03-01T11:00:00Z" };

  const { body: created } = await request(app).post("/api/reservations").set("Authorization", `Bearer ${jan}`).send(body).expect(201);
  await request(app).post("/api/reservations").set("Authorization", `Bearer ${jan}`).send(body).expect(409);
  await request(app).patch(`/api/reservations/${created.id}/cancel`).set("Authorization", `Bearer ${admin}`).expect(200);
  await request(app).patch(`/api/reservations/${created.id}/cancel`).set("Authorization", `Bearer ${admin}`).expect(200);

  expect(await waitForAuditRows(2)).toBe(2);
  await new Promise(r => setTimeout(r, 200)); // upewniamy się, że nie dojdzie nic więcej
  expect(await waitForAuditRows(3, 0)).toBe(2); // 409 i idempotentne anulowanie NIE tworzą wpisów

  const res = await request(app).get("/api/admin/audit-log").set("Authorization", `Bearer ${admin}`).expect(200);
  expect(res.body.meta).toMatchObject({ total: 2, page: 1 });
  expect(res.body.data.map(e => e.eventType)).toEqual(["reservation.cancelled", "reservation.created"]); // od najnowszych
  expect(res.body.data[0].payload).toEqual({ reservationId: created.id, roomId: 1, userId: created.user.id, cancelledBy: 1 });

  const filtered = await request(app).get("/api/admin/audit-log?eventType=reservation.created").set("Authorization", `Bearer ${admin}`).expect(200);
  expect(filtered.body.data).toHaveLength(1);
  expect(filtered.body.data[0].payload).toMatchObject({ reservationId: created.id, startTime: "2030-03-01T10:00:00.000Z" });
});

test("GET /api/admin/audit-log: USER -> 403, nieznany eventType -> 400", async () => {
  await request(app).post("/api/auth/register").send({ email: "jan@example.com", password: "password-123456" }).expect(201);
  const jan = await login("jan@example.com", "password-123456");
  const admin = await login(ADMIN.email, ADMIN.password);

  await request(app).get("/api/admin/audit-log").set("Authorization", `Bearer ${jan}`).expect(403);
  await request(app).get("/api/admin/audit-log?eventType=foo").set("Authorization", `Bearer ${admin}`).expect(400);
});
