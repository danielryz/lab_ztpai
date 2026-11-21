const { Router } = require("express");
const authorize = require("../../middleware/authorize");
const { ROLES } = require("../users/roles");

// Endpoint testowy globalnego error handlera (500) - tylko dla ADMINa
function createDebugRouter() {
  const router = Router();

  router.get("/crash", authorize(ROLES.ADMIN), async () => {
    throw new Error("boom");
  });

  return router;
}

module.exports = { createDebugRouter };
