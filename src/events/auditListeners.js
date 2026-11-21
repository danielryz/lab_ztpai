// Listener audit logu: każdy event rezerwacji -> wiersz w tabeli audit_log (payload jako jsonb).
// Repository dostajemy przez runInTransaction (Unit of Work) - listener nie zna Knexa.
const { EVENTS } = require("./eventBus");

function registerAuditListeners(eventBus, { runInTransaction }) {
  async function saveToAuditLog(event) {
    await runInTransaction(({ auditLogRepository }) =>
      auditLogRepository.create({
        eventType: event.name,
        payload: event.payload,
        createdAt: event.occurredAt
      })
    );
  }

  for (const eventName of Object.values(EVENTS)) {
    eventBus.subscribe(eventName, saveToAuditLog);
  }
}

module.exports = { registerAuditListeners };
