const { Router } = require("express");
function createDebugRouter() {
  const router = Router();

  router.get("/crash", async () => {
    throw new Error("boom");
  });

  return router;
}

module.exports = { createDebugRouter };
