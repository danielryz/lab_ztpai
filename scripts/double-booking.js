// Wysyła równolegle N identycznych requestów POST /api/reservations (ta sama sala, ten sam przedział)
// i sprawdza zapytaniem SQL, ile rezerwacji CONFIRMED powstało w bazie.
//
// Użycie: node scripts/double-booking.js [roomId] [liczbaRequestów]
// Wymaga działającego servera (npm start) i bazy.
const db = require("../src/db/knex");

const BASE = process.env.API_URL || "http://localhost:3000";
const ROOM_ID = Number(process.argv[2] ?? 1);
const REQUESTS = Number(process.argv[3] ?? 10);
const RESERVED_BY = "Double Booking Test";

// Stały przedział w przyszłości: za 30 dni, 10:00-12:00 UTC
const day = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
day.setUTCHours(10, 0, 0, 0);
const START = day.toISOString();
const END = new Date(day.getTime() + 2 * 60 * 60 * 1000).toISOString();

async function book(i) {
  const res = await fetch(`${BASE}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Request-Id": `double-booking-${i}` },
    body: JSON.stringify({ roomId: ROOM_ID, reservedBy: RESERVED_BY, participants: 2, startTime: START, endTime: END })
  });
  const body = await res.json().catch(() => ({}));
  return { i, status: res.status, code: body.error?.code ?? `id=${body.id}` };
}

async function main() {
  // Sprzątanie po poprzednim uruchomieniu - każdy przebieg startuje z tego samego stanu
  await db("reservations").where({ reserved_by: RESERVED_BY }).del();

  console.log(`POST /api/reservations x${REQUESTS} równolegle: room ${ROOM_ID}, ${START} - ${END}\n`);

  const results = await Promise.all(Array.from({ length: REQUESTS }, (_, i) => book(i + 1)));

  for (const r of results) {
    console.log(`request #${String(r.i).padStart(2)} -> ${r.status} ${r.code}`);
  }

  const summary = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
  console.log("\nPodsumowanie status codes:", summary);

  const { rows } = await db.raw(
    `SELECT count(*)::int AS confirmed
       FROM reservations
      WHERE room_id = ?
        AND status = 'CONFIRMED'
        AND tstzrange(start_time, end_time, '[)') && tstzrange(?::timestamptz, ?::timestamptz, '[)')`,
    [ROOM_ID, START, END]
  );
  console.log(`Rezerwacje CONFIRMED w bazie dla sali ${ROOM_ID} w tym przedziale: ${rows[0].confirmed}`);
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
