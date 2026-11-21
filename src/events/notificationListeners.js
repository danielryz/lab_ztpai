// Symulacja powiadomienia (zamiast prawdziwego maila): gdy ADMIN anuluje CUDZĄ rezerwację,
// właściciel dostaje "maila" - tutaj komunikat w konsoli.
const { EVENTS } = require("./eventBus");
const { ROLES } = require("../modules/users/roles");

function registerNotificationListeners(eventBus, { runInTransaction, logger = console }) {
  eventBus.subscribe(EVENTS.RESERVATION_CANCELLED, async function notifyOwnerCancelledByAdmin(event) {
    const { reservationId, roomId, userId, cancelledBy } = event.payload;
    if (cancelledBy === userId) return; // właściciel anulował sam - brak powiadomienia

    const [owner, canceller] = await runInTransaction(({ usersRepository }) =>
      Promise.all([usersRepository.findById(userId), usersRepository.findById(cancelledBy)])
    );
    if (!owner || canceller?.role !== ROLES.ADMIN) return;

    logger.log(
      `[notification] to: ${owner.email} subject: "Rezerwacja #${reservationId} anulowana" ` +
      `body: "Twoja rezerwacja #${reservationId} (sala ${roomId}) została anulowana przez administratora (${canceller.email})."`
    );
  });
}

module.exports = { registerNotificationListeners };
