const { z } = require("zod");

const buildingIdParams = z.object({
  id: z.coerce.number().int().positive()
});

const createBuildingBody = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().min(3).max(255)
}).strict();

// PATCH - częściowa zmiana, ale co najmniej jedno pole
const updateBuildingBody = createBuildingBody.partial().strict().refine(
  b => Object.keys(b).length > 0,
  { message: "At least one field is required" }
);

module.exports = { buildingIdParams, createBuildingBody, updateBuildingBody };
