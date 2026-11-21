// Testy integracyjne: Supertest -> Express (createApp, bez portu) -> service -> Knex -> PostgreSQL (baza *_test)
const request = require("supertest");
const config = require("../../src/config");
const db = require("../../src/db/knex");
const { createApp } = require("../../src/app");
const { createKnexUnitOfWork } = require("../../src/db/unitOfWork.knex");
const { ensureTestDatabase, resetDatabase, ADMIN } = require("./testDb");

const { runInTransaction } = createKnexUnitOfWork(db);
const app = createApp({ config, runInTransaction });

const PASSWORD = "password-123456";

async function registerAndLogin(email) {
  await request(app).post("/api/auth/register").send({ email, password: PASSWORD }).expect(201);
  const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD }).expect(200);
  return res.body.accessToken;
}

async function loginAdmin() {
  const res = await request(app).post("/api/auth/login").send(ADMIN).expect(200);
  return res.body.accessToken;
}

const reservationBody = (overrides = {}) => ({
  roomId: 1, participants: 5, startTime: "2030-01-15T10:00:00Z", endTime: "2030-01-15T12:00:00Z", ...overrides
});

function createReservation(token, overrides) {
  return request(app).post("/api/reservations").set("Authorization", `Bearer ${token}`).send(reservationBody(overrides));
}

beforeAll(async () => {
  await ensureTestDatabase();
  await db.migrate.latest(); // schemat bazy testowej zawsze aktualny
});

beforeEach(async () => {
  await resetDatabase(db); // każdy test startuje od tego samego, czystego stanu
});

afterAll(async () => {
  await db.destroy(); // zamyka pulę połączeń - brak ostrzeżenia Jest o open handles
});

describe("Auth API", () => {
  test("rejestracja + logowanie + GET /api/auth/me", async () => {
    const reg = await request(app).post("/api/auth/register").send({ email: "Jan@Example.com", password: PASSWORD });
    expect(reg.status).toBe(201);
    expect(reg.body).toMatchObject({ email: "jan@example.com", role: "USER" });
    expect(reg.body).not.toHaveProperty("passwordHash");

    const login = await request(app).post("/api/auth/login").send({ email: "jan@example.com", password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({ tokenType: "Bearer", accessToken: expect.any(String) });

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ id: reg.body.id, email: "jan@example.com", role: "USER" });
  });

  test("401 bez tokenu", async () => {
    const res = await request(app).get("/api/reservations");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("Reservations API", () => {
  test("POST /api/reservations -> 201, nagłówek Location i rekord w bazie", async () => {
    const token = await registerAndLogin("jan@example.com");

    const res = await createReservation(token);

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/reservations/${res.body.id}`);
    expect(res.body).toMatchObject({ status: "CONFIRMED", participants: 5, user: { email: "jan@example.com" } });

    const row = await db("reservations").where({ id: res.body.id }).first();
    expect(row).toMatchObject({ room_id: 1, user_id: res.body.user.id, participants: 5, status: "CONFIRMED" });
    expect(row.start_time.toISOString()).toBe("2030-01-15T10:00:00.000Z");
  });

  test("400 z poprawnymi details dla błędnego body", async () => {
    const token = await registerAndLogin("jan@example.com");

    const res = await request(app)
      .post("/api/reservations")
      .set("Authorization", `Bearer ${token}`)
      .send({ roomId: 1, participants: 0, startTime: "jutro" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const fields = res.body.error.details.map(d => d.field);
    expect(fields).toEqual(expect.arrayContaining(["participants", "startTime", "endTime"]));
    expect(res.body.error.details[0]).toMatchObject({ location: "body", message: expect.any(String) });
    expect(await db("reservations").count({ n: "*" }).first()).toEqual({ n: "0" });
  });

  test("409 ROOM_ALREADY_BOOKED dla nakładającej się rezerwacji", async () => {
    const jan = await registerAndLogin("jan@example.com");
    const anna = await registerAndLogin("anna@example.com");
    await createReservation(jan).expect(201);

    const res = await createReservation(anna, { startTime: "2030-01-15T11:00:00Z", endTime: "2030-01-15T13:00:00Z" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ROOM_ALREADY_BOOKED");
    expect(await db("reservations").count({ n: "*" }).first()).toEqual({ n: "1" });
  });

  test("404 dla USER pobierającego cudzą rezerwację", async () => {
    const jan = await registerAndLogin("jan@example.com");
    const anna = await registerAndLogin("anna@example.com");
    const { body: created } = await createReservation(jan).expect(201);

    const res = await request(app).get(`/api/reservations/${created.id}`).set("Authorization", `Bearer ${anna}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  test("pagination: meta.total i liczba elementów w data dla limit < liczby rekordów", async () => {
    const jan = await registerAndLogin("jan@example.com");
    for (let day = 10; day < 15; day++) {
      await createReservation(jan, { startTime: `2030-02-${day}T10:00:00Z`, endTime: `2030-02-${day}T11:00:00Z` }).expect(201);
    }

    const res = await request(app).get("/api/reservations?limit=2&page=2").set("Authorization", `Bearer ${jan}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 });
    expect(res.body.data.map(r => r.startTime)).toEqual(["2030-02-12T10:00:00.000Z", "2030-02-13T10:00:00.000Z"]);
  });
});

describe("Rooms API - role", () => {
  test("403 dla USER próbującego utworzyć salę, ADMIN dostaje 201", async () => {
    const user = await registerAndLogin("jan@example.com");
    const admin = await loginAdmin();
    const body = { buildingId: 1, name: "201", capacity: 8 };

    const forbidden = await request(app).post("/api/rooms").set("Authorization", `Bearer ${user}`).send(body);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");
    expect(await db("rooms").where({ name: "201" }).first()).toBeUndefined();

    await request(app).post("/api/rooms").set("Authorization", `Bearer ${admin}`).send(body).expect(201);
  });
});
