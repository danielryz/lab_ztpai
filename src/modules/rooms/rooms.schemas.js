const { z } = require("zod");

const roomIdParams = z.object({
  id: z.coerce.number().int().positive()
});

const createRoomBody = z.object({
  buildingId: z.number().int().positive(),
  name: z.string().trim().min(1).max(50),
  capacity: z.number().int().positive()
}).strict();

// PATCH - nazwa i pojemność (przeniesienie sali do innego budynku nie jest wspierane)
const updateRoomBody = createRoomBody.omit({ buildingId: true }).partial().strict().refine(
  b => Object.keys(b).length > 0,
  { message: "At least one field is required" }
);

module.exports = { roomIdParams, createRoomBody, updateRoomBody };
