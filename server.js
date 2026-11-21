const express = require("express");

const app = express();
app.use(express.json());

// Dane przechowywane w pamięci (bez bazy danych)
const rooms = [
  { id: 1, name: "A101", capacity: 30 },
  { id: 2, name: "A102", capacity: 20 },
  { id: 3, name: "B201", capacity: 50 },
  { id: 4, name: "C301", capacity: 10 }
];

const reservations = [];

// Zadanie 1 - Rooms API
app.get("/api/rooms", (req, res) => {
  res.json(rooms);
});

app.get("/api/rooms/:id", (req, res) => {
  const id = Number(req.params.id);
  const room = rooms.find(room => room.id === id);

  if (!room) {
    return res.status(404).json({ message: "Room not found" });
  }

  res.json(room);
});

// Zadanie 2 i 3 - Tworzenie rezerwacji + validation + pojemność sali
app.post("/api/reservations", (req, res) => {
  const { roomId, reservedBy, participants, date } = req.body;

  if (roomId === undefined) {
    return res.status(400).json({ message: "roomId is required" });
  }
  if (!reservedBy || String(reservedBy).trim() === "") {
    return res.status(400).json({ message: "reservedBy is required" });
  }
  if (typeof participants !== "number" || participants <= 0) {
    return res.status(400).json({ message: "participants must be a number greater than 0" });
  }
  if (!date) {
    return res.status(400).json({ message: "date is required" });
  }

  const room = rooms.find(room => room.id === Number(roomId));
  if (!room) {
    return res.status(404).json({ message: "Room not found" });
  }

  // Zadanie 3 - business rule
  if (participants > room.capacity) {
    return res.status(409).json({ message: "Room capacity exceeded" });
  }

  const reservation = {
    id: reservations.length + 1,
    roomId: room.id,
    reservedBy: String(reservedBy).trim(),
    participants,
    date,
    status: "CONFIRMED"
  };

  reservations.push(reservation);
  res.status(201).json(reservation);
});

// Zadanie 4 - Pobieranie i filtrowanie rezerwacji
app.get("/api/reservations", (req, res) => {
  const { roomId } = req.query;

  if (roomId === undefined) {
    return res.json(reservations);
  }

  const result = reservations.filter(r => r.roomId === Number(roomId));
  res.json(result);
});

// Zadanie 5 - Anulowanie rezerwacji
app.patch("/api/reservations/:id/cancel", (req, res) => {
  const id = Number(req.params.id);
  const reservation = reservations.find(r => r.id === id);

  if (!reservation) {
    return res.status(404).json({ message: "Reservation not found" });
  }

  reservation.status = "CANCELLED";
  res.json(reservation);
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
