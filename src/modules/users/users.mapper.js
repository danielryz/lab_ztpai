// Jawna lista pól - passwordHash nigdy nie trafia do response
function toUserResponse(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  };
}

module.exports = { toUserResponse };
