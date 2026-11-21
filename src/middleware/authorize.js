const { UnauthorizedError, ForbiddenError } = require("../errors/AppError");

// Użycie: router.post("/", authorize("ADMIN"), ...) - zawsze PO authenticate
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new UnauthorizedError());
    if (!roles.includes(req.user.role)) return next(new ForbiddenError());
    next();
  };
}

module.exports = authorize;
