// Każde seed:run daje ten sam stan: TRUNCATE ... RESTART IDENTITY => ID zawsze od 1
// Uruchamiany PO 00_users.js - user_id wskazuje na konta z tamtego seeda.
const HOUR = 60 * 60 * 1000;

exports.seed = async function (knex) {
  await knex.raw("TRUNCATE reservations, rooms, buildings RESTART IDENTITY CASCADE");

  await knex("buildings").insert([
    { name: "Budynek A", address: "ul. Warszawska 24, Kraków" },   // id 1
    { name: "Budynek B", address: "ul. Podchorążych 2, Kraków" },  // id 2
    { name: "Budynek C", address: "ul. Krótka 1, Kraków" }         // id 3 - bez sal
  ]);

  await knex("rooms").insert([
    { building_id: 1, name: "001", capacity: 10 },  // id 1
    { building_id: 1, name: "102", capacity: 20 },  // id 2
    { building_id: 1, name: "101", capacity: 30 },  // id 3
    { building_id: 2, name: "101", capacity: 50 },  // id 4 - ta sama nazwa co id 3, inny budynek
    { building_id: 2, name: "201", capacity: 12 }   // id 5
  ]);

  const now = Date.now();

  await knex("reservations").insert([
    {
      room_id: 3, user_id: 2,  // jan.kowalski
      participants: 20,
      start_time: "2026-11-10T10:00:00Z", end_time: "2026-11-10T12:00:00Z",
      status: "CONFIRMED", created_at: "2026-10-27T08:00:00Z"
    },
    {
      // styka się z rezerwacją 1 (12:00) - dozwolone
      room_id: 3, user_id: 3,  // anna.nowak
      participants: 12,
      start_time: "2026-11-10T12:00:00Z", end_time: "2026-11-10T13:00:00Z",
      status: "CONFIRMED", created_at: "2026-10-28T09:30:00Z"
    },
    {
      room_id: 1, user_id: 4,  // piotr.wisniewski
      participants: 8,
      start_time: "2026-11-12T09:00:00Z", end_time: "2026-11-12T10:30:00Z",
      status: "CANCELLED", cancelled_at: "2026-10-30T15:00:00Z", created_at: "2026-10-29T11:00:00Z"
    },
    {
      // już się rozpoczęła (trwa w momencie seedowania) - do testu RESERVATION_ALREADY_STARTED
      room_id: 4, user_id: 2,  // jan.kowalski
      participants: 5,
      start_time: new Date(now - HOUR), end_time: new Date(now + HOUR),
      status: "CONFIRMED", created_at: new Date(now - 24 * HOUR)
    },
    {
      room_id: 5, user_id: 5,  // maria.zielinska
      participants: 6,
      start_time: "2026-11-20T14:00:00Z", end_time: "2026-11-20T16:00:00Z",
      status: "CONFIRMED", created_at: "2026-10-31T10:00:00Z"
    }
  ]);
};
