const { Router } = require("express");
const validate = require("../../middleware/validate");
const authorize = require("../../middleware/authorize");
const { ROLES } = require("../users/roles");
const { buildingIdParams, createBuildingBody, updateBuildingBody } = require("./buildings.schemas");

// authenticate działa globalnie (app.js). GET - każdy zalogowany, zmiany - tylko ADMIN.
function createBuildingsRouter(controller) {
  const router = Router();
  const adminOnly = authorize(ROLES.ADMIN);

  router.get("/", controller.list);
  router.get("/:id", validate({ params: buildingIdParams }), controller.getById);
  router.get("/:id/rooms", validate({ params: buildingIdParams }), controller.listRooms);
  router.post("/", adminOnly, validate({ body: createBuildingBody }), controller.create);
  router.patch("/:id", adminOnly, validate({ params: buildingIdParams, body: updateBuildingBody }), controller.update);
  router.delete("/:id", adminOnly, validate({ params: buildingIdParams }), controller.remove);

  return router;
}

module.exports = { createBuildingsRouter };
