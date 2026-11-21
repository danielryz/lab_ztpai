const { Router } = require("express");
const validate = require("../../middleware/validate");
const authorize = require("../../middleware/authorize");
const { ROLES } = require("../users/roles");
const { roomIdParams, createRoomBody, updateRoomBody } = require("./rooms.schemas");

// authenticate działa globalnie (app.js). GET - każdy zalogowany, zmiany - tylko ADMIN.
function createRoomsRouter(controller) {
  const router = Router();
  const adminOnly = authorize(ROLES.ADMIN);

  router.get("/", controller.list);
  router.get("/:id", validate({ params: roomIdParams }), controller.getById);
  router.post("/", adminOnly, validate({ body: createRoomBody }), controller.create);
  router.patch("/:id", adminOnly, validate({ params: roomIdParams, body: updateRoomBody }), controller.update);
  router.delete("/:id", adminOnly, validate({ params: roomIdParams }), controller.remove);

  return router;
}

module.exports = { createRoomsRouter };
