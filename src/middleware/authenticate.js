const jwt = require("jsonwebtoken");
const { UnauthorizedError } = require("../errors/AppError");
const { ALL_ROLES } = require("../modules/users/roles");

// Dokładnie "Bearer <token>" - "Basic ...", samo "Bearer" albo "Bearer a b" to zły format
const BEARER = /^Bearer ([A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*)$/;

function createAuthenticate(tokenService) {
  return function authenticate(req, res, next) {
    const header = req.get("Authorization");
    if (!header) {
      return next(new UnauthorizedError("Missing Authorization header", "UNAUTHORIZED"));
    }

    const match = BEARER.exec(header);
    if (!match) {
      return next(new UnauthorizedError("Authorization header must be: Bearer <token>", "INVALID_AUTH_HEADER"));
    }

    let payload;
    try {
      // Zły podpis, zmieniony payload, zły algorytm -> JsonWebTokenError
      payload = tokenService.verify(match[1]);
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        // Osobny kod - frontend wie, że wystarczy ponowne logowanie
        return next(new UnauthorizedError("Token expired", "TOKEN_EXPIRED"));
      }
      return next(new UnauthorizedError("Invalid token", "INVALID_TOKEN"));
    }

    // Podpis się zgadza, ale sprawdzamy też kształt payloadu
    if (typeof payload.sub !== "string" || !/^[1-9]\d*$/.test(payload.sub) || !ALL_ROLES.includes(payload.role)) {
      return next(new UnauthorizedError("Invalid token", "INVALID_TOKEN"));
    }

    req.user = { id: Number(payload.sub), role: payload.role };
    next();
  };
}

module.exports = { createAuthenticate };
