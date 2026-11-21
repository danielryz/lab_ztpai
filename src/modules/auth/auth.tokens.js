const jwt = require("jsonwebtoken");

const ALGORITHM = "HS256";

function createTokenService({ secret, expiresIn }) {
  return {
    expiresIn,

    // Payload: sub, role, iat, exp - bez emaila, hasha i innych danych osobowych
    sign(user) {
      return jwt.sign({ role: user.role }, secret, {
        algorithm: ALGORITHM,
        subject: String(user.id),
        expiresIn
      });
    },

    // Algorytm podany jawnie - token z innym "alg" (np. none) zostanie odrzucony
    verify(token) {
      return jwt.verify(token, secret, { algorithms: [ALGORITHM] });
    }
  };
}

module.exports = { createTokenService };
