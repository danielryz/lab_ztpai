// Event bus w pamięci procesu, oparty o EventEmitter z Node.js.
// EventEmitter.emit() jest SYNCHRONICZNY - wyjątek w listenerze poleciałby do service, a odrzucony Promise
// listenera async byłby "unhandled rejection". Dlatego każdy handler:
//   - uruchamiamy asynchronicznie (Promise.resolve().then) - publish() wraca od razu,
//   - łapiemy jego błąd (sync i async) i tylko logujemy - błąd listenera NIE wpływa na odpowiedź API.
const { EventEmitter } = require("node:events");

function createEventBus({ logger = console } = {}) {
  const emitter = new EventEmitter();

  return {
    publish(eventName, payload) {
      emitter.emit(eventName, { name: eventName, occurredAt: new Date().toISOString(), payload });
    },

    subscribe(eventName, handler) {
      emitter.on(eventName, event => {
        Promise.resolve()
          .then(() => handler(event))
          .catch(err => logger.error(`[event:${eventName}] handler ${handler.name || "anonymous"} failed:`, err));
      });
    }
  };
}

// Null object - domyślny bus, gdy nikt nie przekaże prawdziwego (np. część testów)
const noopEventBus = Object.freeze({ publish() {}, subscribe() {} });

const EVENTS = Object.freeze({
  RESERVATION_CREATED: "reservation.created",
  RESERVATION_CANCELLED: "reservation.cancelled"
});

module.exports = { createEventBus, noopEventBus, EVENTS };
