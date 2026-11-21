// Repositories in-memory udają błędy PostgreSQL (te same kody SQLSTATE),
// żeby error handler i API zachowywały się identycznie dla obu implementacji.
function pgLikeError(code, message) {
  return Object.assign(new Error(message), { code });
}

const uniqueViolation = () => pgLikeError("23505", "unique_violation");
const exclusionViolation = () => pgLikeError("23P01", "exclusion_violation");

module.exports = { uniqueViolation, exclusionViolation };
