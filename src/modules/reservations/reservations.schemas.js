const { z } = require("zod");

const reservationIdParams = z.object({
  id: z.coerce.number().int().positive()
});

const createReservationBody = z.object({
  roomId: z.number().int().positive(),
  participants: z.number().int().positive(),
  startTime: z.iso.datetime({ offset: true }),
  endTime: z.iso.datetime({ offset: true })
}).strict(); // userId / reservedBy w body -> 400 (właściciel pochodzi wyłącznie z tokenu)

// Whitelista sortowania - nieznana wartość -> 400
const SORT_VALUES = ["startTime", "-startTime", "createdAt", "-createdAt", "participants", "-participants"];

const listReservationsQuery = z.object({
  // Tylko dla ADMINa - uprawnienie sprawdza service
  userId: z.coerce.number().int().positive().optional(),
  roomId: z.coerce.number().int().positive().optional(),
  buildingId: z.coerce.number().int().positive().optional(),
  status: z.enum(["CONFIRMED", "CANCELLED"]).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(SORT_VALUES).default("startTime")
}).refine(
  q => !q.from || !q.to || new Date(q.from) < new Date(q.to),
  { message: "from must be earlier than to", path: ["from"] }
);

module.exports = { reservationIdParams, createReservationBody, listReservationsQuery };
