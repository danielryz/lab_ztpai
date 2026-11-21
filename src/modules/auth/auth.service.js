const bcrypt = require("bcryptjs");
const { ConflictError, NotFoundError, UnauthorizedError } = require("../../errors/AppError");
const { ROLES } = require("../users/roles");

const PG_UNIQUE_VIOLATION = "23505";

// Repositories przez runInTransaction (Unit of Work) - jak w pozostałych services
function createAuthService({ runInTransaction, tokenService, bcryptCost }) {
  // Hash "na niby" - przy nieistniejącym emailu i tak liczymy bcrypt.compare,
  // żeby czas odpowiedzi nie zdradzał, czy konto istnieje.
  let dummyHash;
  const getDummyHash = async () => (dummyHash ??= await bcrypt.hash("dummy-password-for-timing", bcryptCost));

  async function register({ email, password }) {
    const passwordHash = await bcrypt.hash(password, bcryptCost);

    try {
      // Rola zawsze USER - ADMIN powstaje tylko w seedzie
      return await runInTransaction(({ usersRepository }) =>
        usersRepository.create({ email, passwordHash, role: ROLES.USER })
      );
    } catch (err) {
      // Bez wcześniejszego SELECT-a: UNIQUE w bazie obsługuje też równoległe rejestracje
      if (err.code === PG_UNIQUE_VIOLATION) {
        throw new ConflictError("Email is already registered", "EMAIL_TAKEN");
      }
      throw err;
    }
  }

  async function login({ email, password }) {
    const user = await runInTransaction(({ usersRepository }) => usersRepository.findByEmail(email));
    const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? (await getDummyHash()));

    // Zły email i złe hasło -> identyczna odpowiedź
    if (!user || !passwordOk) {
      throw new UnauthorizedError("Invalid email or password", "INVALID_CREDENTIALS");
    }

    return {
      accessToken: tokenService.sign(user),
      tokenType: "Bearer",
      expiresIn: tokenService.expiresIn
    };
  }

  async function getCurrentUser(currentUser) {
    const user = await runInTransaction(({ usersRepository }) => usersRepository.findById(currentUser.id));
    // Token poprawny, ale konto usunięte
    if (!user) throw new NotFoundError("User");
    return user;
  }

  return { register, login, getCurrentUser };
}

module.exports = { createAuthService };
