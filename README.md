# Room Booking API

![CI](https://github.com/danielryz/lab_ztpai/actions/workflows/ci.yml/badge.svg)

REST API do rezerwacji sal: Node.js 22, Express 5, PostgreSQL 16 (Knex), JWT (role USER / ADMIN),
testy (Jest + Supertest), eventy z audit logiem, Docker Compose i CI w GitHub Actions.

## Uruchomienie od zera (Docker)

Wymagany tylko Docker (Docker Desktop / Docker Engine z Compose v2).

```bash
git clone https://github.com/danielryz/lab_ztpai.git
cd lab_ztpai
cp .env.example .env
docker compose up --build
```

Po chwili:

- API: http://localhost:3000
- Swagger UI: http://localhost:3000/api/docs

Kontener `api` czeka, aż baza będzie `healthy`, a przy starcie sam wykonuje migracje.

### Dane przykładowe i konto ADMIN (opcjonalnie)

W drugim terminalu, przy działających kontenerach:

```bash
docker compose exec api npx knex seed:run
```

Seed tworzy budynki, sale, rezerwacje oraz konta z `.env`:
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (ADMIN) i `jan.kowalski@example.com` itd. / `SEED_USER_PASSWORD` (USER).
W Swagger UI: `POST /api/auth/login` → skopiuj `accessToken` → **Authorize**.

### Zatrzymanie

```bash
docker compose down      # kontenery znikają, dane bazy zostają (volume pgdata)
docker compose down -v   # razem z danymi
```

Aplikacja obsługuje `SIGTERM` (graceful shutdown), więc `docker compose down` nie czeka 10 s na `SIGKILL`.

## Testy

```bash
npm ci
docker compose up -d db      # PostgreSQL dla testów integracyjnych (port 5435)
npm test                     # unit + integration
npm run test:unit            # tylko unit - nie potrzebują bazy
npm run test:integration     # tylko integration
```

Testy integracyjne używają osobnej bazy `TEST_DATABASE_URL` (nazwa musi kończyć się na `_test`).
Baza jest tworzona automatycznie, a schemat - migracjami w `beforeAll`.

## Uruchomienie bez Dockera dla API

```bash
npm ci
docker compose up -d db
npm run migrate
npm run seed
npm run dev
```

## Eventy i audit log

Service rezerwacji publikuje po zatwierdzeniu transakcji `reservation.created` i `reservation.cancelled`.
Listenery zapisują je do tabeli `audit_log` (`jsonb`) i symulują powiadomienie właściciela, gdy rezerwację anuluje ADMIN.
Podgląd: `GET /api/admin/audit-log?eventType=reservation.cancelled&page=1&limit=20` (tylko ADMIN).

## Struktura

```text
src/
  app.js              createApp() - Express bez listen (używane przez Supertest)
  server.js           composition root: repositories, event bus, listen, graceful shutdown
  config/             walidacja zmiennych środowiskowych (Zod)
  events/             eventBus (EventEmitter), auditListeners, notificationListeners
  modules/            auth, buildings, rooms, reservations, users, audit
  db/                 knex, migracje, seedy, unit of work (Knex / in-memory)
tests/
  setupEnv.js         zmienne dla testów (baza *_test)
  unit/               service + repositories in-memory + zamrożony czas
  integration/        Supertest + PostgreSQL
.github/workflows/ci.yml
```
