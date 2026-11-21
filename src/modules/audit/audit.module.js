// GET /api/admin/audit-log - tylko ADMIN, pagination + filtr ?eventType=, od najnowszych
const { Router } = require("express");
const { z } = require("zod");
const validate = require("../../middleware/validate");
const authorize = require("../../middleware/authorize");
const { ROLES } = require("../users/roles");
const { EVENTS } = require("../../events/eventBus");

const listAuditLogQuery = z.object({
  eventType: z.enum(Object.values(EVENTS)).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

function createAuditService({ runInTransaction }) {
  return {
    async listAuditLog(query) {
      const { items, total } = await runInTransaction(({ auditLogRepository }) => auditLogRepository.findAll(query));
      return { items, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
    }
  };
}

const toAuditLogResponse = e => ({
  id: e.id,
  eventType: e.eventType,
  payload: e.payload,
  createdAt: new Date(e.createdAt).toISOString()
});

function createAdminRouter(auditService) {
  const router = Router();
  router.use(authorize(ROLES.ADMIN));

  router.get("/audit-log", validate({ query: listAuditLogQuery }), async (req, res) => {
    const { items, meta } = await auditService.listAuditLog(req.validated.query);
    res.json({ data: items.map(toAuditLogResponse), meta });
  });

  return router;
}

module.exports = { createAuditService, createAdminRouter, listAuditLogQuery };
