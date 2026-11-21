const { AppError } = require("../errors/AppError");

// Błędy PostgreSQL (SQLSTATE) -> odpowiedź HTTP. Nigdy nie wysyłamy klientowi err.detail / err.constraint
// (zawierają nazwy tabel, kolumn i wartości).
const PG_ERRORS = {
  "23505": { status: 409, code: "UNIQUE_VIOLATION", message: "Resource already exists" },
  "23P01": { status: 409, code: "ROOM_ALREADY_BOOKED", message: "Room is already booked in this time range" },
  "23503": { status: 409, code: "FOREIGN_KEY_VIOLATION", message: "Related resource does not exist or is still in use" },
  "23514": { status: 400, code: "CHECK_VIOLATION", message: "Data violates a database rule" }
};

function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId: req.id
      }
    });
  }

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      error: { code: "INVALID_JSON", message: "Request body is not valid JSON", requestId: req.id }
    });
  }

  const pg = PG_ERRORS[err.code];
  if (pg) {
    console.warn(`[${req.id}] Database constraint (${err.code}): ${err.constraint ?? err.message}`);
    return res.status(pg.status).json({
      error: { code: pg.code, message: pg.message, requestId: req.id }
    });
  }

  console.error(`[${req.id}] Unhandled error:`, err);

  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Unexpected error", requestId: req.id }
  });
}

module.exports = errorHandler;
