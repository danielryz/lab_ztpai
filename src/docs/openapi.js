// Specyfikacja OpenAPI 3 dla Swagger UI (/api/docs, surowy JSON: /api/docs.json).
// Format błędu zdefiniowany RAZ w components/schemas/Error i używany wszędzie przez $ref.

const json = schema => ({ "application/json": { schema } });
const ref = name => ({ $ref: `#/components/schemas/${name}` });

const ok = (description, schema) => ({ description, content: json(schema) });
// Każda odpowiedź błędu: schemat przez $ref + własny przykład z właściwym kodem
const err = (description, code = "VALIDATION_ERROR", message = description) => ({
  description,
  content: {
    "application/json": {
      schema: ref("Error"),
      example: { error: { code, message, requestId: "3f1c2a9e-8f0b-4a51-9a0e-5d2b7c1e4f00" } }
    }
  }
});

// Odpowiedzi wspólne (components/responses) - też przez $ref
const R = {
  400: { $ref: "#/components/responses/ValidationError" },
  401: { $ref: "#/components/responses/Unauthorized" },
  403: { $ref: "#/components/responses/Forbidden" },
  404: { $ref: "#/components/responses/NotFound" }
};

const idParam = (name, description) => ({
  name, in: "path", required: true, description, schema: { type: "integer", minimum: 1 }
});

const body = schemaName => ({ required: true, content: json(ref(schemaName)) });

module.exports = {
  openapi: "3.0.3",
  info: {
    title: "Room Booking API",
    version: "4.0.0",
    description: [
      "Zadanie 04 - authentication (JWT HS256), authorization (role + ownership), konfiguracja.",
      "",
      "**Jak wywołać chroniony endpoint:** `POST /api/auth/login` → skopiuj `accessToken` → przycisk **Authorize** → wklej token (bez słowa Bearer).",
      "",
      "Role: **USER** - przegląda budynki i sale, tworzy rezerwacje, widzi i anuluje tylko swoje. " +
      "**ADMIN** - dodatkowo zarządza budynkami i salami, widzi i anuluje wszystkie rezerwacje."
    ].join("\n")
  },
  servers: [{ url: "/" }],
  // Domyślnie wszystko wymaga tokenu; publiczne endpointy mają security: []
  security: [{ bearerAuth: [] }],
  tags: [
    { name: "Auth", description: "Rejestracja, logowanie, dane zalogowanego użytkownika" },
    { name: "Buildings", description: "GET - każdy zalogowany, POST/PATCH/DELETE - tylko ADMIN" },
    { name: "Rooms", description: "GET - każdy zalogowany, POST/PATCH/DELETE - tylko ADMIN" },
    { name: "Reservations", description: "USER - tylko własne rezerwacje (cudze → 404), ADMIN - wszystkie" }
  ],

  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
    },

    responses: {
      ValidationError: err("Błąd walidacji (VALIDATION_ERROR) albo niepoprawny JSON (INVALID_JSON)", "VALIDATION_ERROR", "Validation failed"),
      Unauthorized: err("Brak / zły / wygasły token: UNAUTHORIZED, INVALID_AUTH_HEADER, INVALID_TOKEN, TOKEN_EXPIRED", "TOKEN_EXPIRED", "Token expired"),
      Forbidden: err("Rola nie pozwala na tę operację (FORBIDDEN)", "FORBIDDEN", "You do not have permission to perform this action"),
      NotFound: err("Zasób nie istnieje (NOT_FOUND)", "NOT_FOUND", "Reservation not found")
    },

    schemas: {
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message", "requestId"],
            properties: {
              code: { type: "string", example: "VALIDATION_ERROR" },
              message: { type: "string", example: "Validation failed" },
              details: {
                type: "array",
                nullable: true,
                description: "Tylko dla błędów walidacji",
                items: {
                  type: "object",
                  properties: {
                    location: { type: "string", enum: ["params", "query", "body"] },
                    field: { type: "string", example: "password" },
                    message: { type: "string", example: "Too small: expected string to have >=10 characters" }
                  }
                }
              },
              requestId: { type: "string", example: "3f1c2a9e-8f0b-4a51-9a0e-5d2b7c1e4f00" }
            }
          }
        }
      },

      Role: { type: "string", enum: ["USER", "ADMIN"] },
      User: {
        type: "object",
        properties: {
          id: { type: "integer", example: 2 },
          email: { type: "string", format: "email", example: "jan.kowalski@example.com" },
          role: ref("Role"),
          createdAt: { type: "string", format: "date-time" }
        }
      },
      RegisterRequest: {
        type: "object",
        required: ["email", "password"],
        additionalProperties: false,
        properties: {
          email: { type: "string", format: "email", maxLength: 254, example: "Jan.Kowalski@example.com" },
          password: { type: "string", minLength: 10, maxLength: 72, example: "bardzo-dlugie-haslo" }
        }
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        additionalProperties: false,
        properties: {
          email: { type: "string", format: "email", example: "jan.kowalski@example.com" },
          password: { type: "string", example: "bardzo-dlugie-haslo" }
        }
      },
      LoginResponse: {
        type: "object",
        properties: {
          accessToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
          tokenType: { type: "string", example: "Bearer" },
          expiresIn: { type: "string", example: "15m" }
        }
      },

      BuildingRef: {
        type: "object",
        properties: { id: { type: "integer", example: 1 }, name: { type: "string", example: "Budynek A" } }
      },
      Building: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Budynek A" },
          address: { type: "string", example: "ul. Warszawska 24, Kraków" },
          roomsCount: { type: "integer", example: 3 },
          createdAt: { type: "string", format: "date-time" }
        }
      },
      CreateBuildingRequest: {
        type: "object",
        required: ["name", "address"],
        additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 1, maxLength: 120, example: "Budynek D" },
          address: { type: "string", minLength: 3, maxLength: 255, example: "ul. Nowa 5, Kraków" }
        }
      },
      UpdateBuildingRequest: {
        type: "object",
        minProperties: 1,
        additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 1, maxLength: 120 },
          address: { type: "string", minLength: 3, maxLength: 255 }
        }
      },

      Room: {
        type: "object",
        properties: {
          id: { type: "integer", example: 3 },
          name: { type: "string", example: "101" },
          capacity: { type: "integer", example: 30 },
          building: ref("BuildingRef")
        }
      },
      CreateRoomRequest: {
        type: "object",
        required: ["buildingId", "name", "capacity"],
        additionalProperties: false,
        properties: {
          buildingId: { type: "integer", minimum: 1, example: 3 },
          name: { type: "string", minLength: 1, maxLength: 50, example: "301" },
          capacity: { type: "integer", minimum: 1, example: 15 }
        }
      },
      UpdateRoomRequest: {
        type: "object",
        minProperties: 1,
        additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 1, maxLength: 50 },
          capacity: { type: "integer", minimum: 1 }
        }
      },

      Reservation: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          room: {
            type: "object",
            properties: {
              id: { type: "integer", example: 3 },
              name: { type: "string", example: "101" },
              building: ref("BuildingRef")
            }
          },
          user: {
            type: "object",
            properties: {
              id: { type: "integer", example: 2 },
              email: { type: "string", example: "jan.kowalski@example.com" }
            }
          },
          participants: { type: "integer", example: 20 },
          startTime: { type: "string", format: "date-time" },
          endTime: { type: "string", format: "date-time" },
          status: { type: "string", enum: ["CONFIRMED", "CANCELLED"] },
          createdAt: { type: "string", format: "date-time" },
          cancelledAt: { type: "string", format: "date-time", nullable: true }
        }
      },
      CreateReservationRequest: {
        type: "object",
        required: ["roomId", "participants", "startTime", "endTime"],
        additionalProperties: false,
        description: "Właściciel rezerwacji pochodzi wyłącznie z tokenu - pole userId / reservedBy w body → 400.",
        properties: {
          roomId: { type: "integer", minimum: 1, example: 2 },
          participants: { type: "integer", minimum: 1, example: 10 },
          startTime: { type: "string", format: "date-time", example: "2026-12-15T10:00:00Z" },
          endTime: { type: "string", format: "date-time", example: "2026-12-15T11:30:00Z" }
        }
      },
      ReservationList: {
        type: "object",
        properties: {
          data: { type: "array", items: ref("Reservation") },
          meta: {
            type: "object",
            properties: {
              page: { type: "integer", example: 1 },
              limit: { type: "integer", example: 20 },
              total: { type: "integer", example: 2 },
              totalPages: { type: "integer", example: 1 }
            }
          }
        }
      }
    }
  },

  paths: {
    // ---------- Auth ----------
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Rejestracja (zawsze rola USER)",
        description: "Email normalizowany do małych liter. Pole role (lub inne nieznane) → 400.",
        security: [],
        requestBody: body("RegisterRequest"),
        responses: {
          201: ok("Utworzono konto", ref("User")),
          400: err("Zły email, hasło spoza 10-72 znaków albo nieznane pole (np. role)"),
          409: err("Email zajęty (EMAIL_TAKEN) - także przy równoległych rejestracjach", "EMAIL_TAKEN", "Email is already registered")
        }
      }
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Logowanie - zwraca JWT (HS256, claims: sub, role, iat, exp)",
        security: [],
        requestBody: body("LoginRequest"),
        responses: {
          200: ok("Zalogowano", ref("LoginResponse")),
          400: R[400],
          401: err("INVALID_CREDENTIALS - identyczna odpowiedź dla złego emaila i złego hasła", "INVALID_CREDENTIALS", "Invalid email or password")
        }
      }
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Dane zalogowanego użytkownika (bez hasha)",
        responses: {
          200: ok("OK", ref("User")),
          401: R[401],
          404: err("Konto z tokenu już nie istnieje", "NOT_FOUND", "User not found")
        }
      }
    },

    // ---------- Buildings ----------
    "/api/buildings": {
      get: {
        tags: ["Buildings"],
        summary: "Lista budynków z liczbą sal",
        responses: { 200: ok("OK", { type: "array", items: ref("Building") }), 401: R[401] }
      },
      post: {
        tags: ["Buildings"],
        summary: "Nowy budynek (ADMIN)",
        requestBody: body("CreateBuildingRequest"),
        responses: {
          201: ok("Utworzono", ref("Building")),
          400: R[400], 401: R[401], 403: R[403],
          409: err("Budynek o tej nazwie już istnieje (UNIQUE_VIOLATION)", "UNIQUE_VIOLATION", "Resource already exists")
        }
      }
    },
    "/api/buildings/{id}": {
      parameters: [idParam("id", "ID budynku")],
      get: {
        tags: ["Buildings"],
        summary: "Jeden budynek",
        responses: { 200: ok("OK", ref("Building")), 400: R[400], 401: R[401], 404: R[404] }
      },
      patch: {
        tags: ["Buildings"],
        summary: "Zmiana nazwy / adresu (ADMIN)",
        requestBody: body("UpdateBuildingRequest"),
        responses: {
          200: ok("Zmieniono", ref("Building")),
          400: R[400], 401: R[401], 403: R[403], 404: R[404],
          409: err("Nazwa zajęta (UNIQUE_VIOLATION)", "UNIQUE_VIOLATION", "Resource already exists")
        }
      },
      delete: {
        tags: ["Buildings"],
        summary: "Usunięcie budynku bez sal (ADMIN)",
        responses: {
          204: { description: "Usunięto" },
          400: R[400], 401: R[401], 403: R[403], 404: R[404],
          409: err("W budynku są sale (BUILDING_HAS_ROOMS)", "BUILDING_HAS_ROOMS", "Building still has rooms and cannot be deleted")
        }
      }
    },
    "/api/buildings/{id}/rooms": {
      parameters: [idParam("id", "ID budynku")],
      get: {
        tags: ["Buildings"],
        summary: "Sale w budynku",
        responses: { 200: ok("OK", { type: "array", items: ref("Room") }), 400: R[400], 401: R[401], 404: R[404] }
      }
    },

    // ---------- Rooms ----------
    "/api/rooms": {
      get: {
        tags: ["Rooms"],
        summary: "Lista sal z budynkiem",
        responses: { 200: ok("OK", { type: "array", items: ref("Room") }), 401: R[401] }
      },
      post: {
        tags: ["Rooms"],
        summary: "Nowa sala (ADMIN)",
        requestBody: body("CreateRoomRequest"),
        responses: {
          201: ok("Utworzono", ref("Room")),
          400: R[400], 401: R[401], 403: R[403],
          404: err("Budynek nie istnieje", "NOT_FOUND", "Building not found"),
          409: err("Sala o tej nazwie już jest w budynku (UNIQUE_VIOLATION)", "UNIQUE_VIOLATION", "Resource already exists")
        }
      }
    },
    "/api/rooms/{id}": {
      parameters: [idParam("id", "ID sali")],
      get: {
        tags: ["Rooms"],
        summary: "Jedna sala",
        responses: { 200: ok("OK", ref("Room")), 400: R[400], 401: R[401], 404: R[404] }
      },
      patch: {
        tags: ["Rooms"],
        summary: "Zmiana nazwy / pojemności (ADMIN)",
        requestBody: body("UpdateRoomRequest"),
        responses: {
          200: ok("Zmieniono", ref("Room")),
          400: R[400], 401: R[401], 403: R[403], 404: R[404],
          409: err("Nazwa zajęta (UNIQUE_VIOLATION) albo pojemność mniejsza niż przyszła rezerwacja (CAPACITY_BELOW_RESERVATIONS)", "CAPACITY_BELOW_RESERVATIONS", "Capacity 5 is lower than participants of upcoming reservation 1 (20)")
        }
      },
      delete: {
        tags: ["Rooms"],
        summary: "Usunięcie sali bez rezerwacji (ADMIN)",
        responses: {
          204: { description: "Usunięto" },
          400: R[400], 401: R[401], 403: R[403], 404: R[404],
          409: err("Sala ma rezerwacje (ROOM_HAS_RESERVATIONS)", "ROOM_HAS_RESERVATIONS", "Room has reservations and cannot be deleted")
        }
      }
    },

    // ---------- Reservations ----------
    "/api/reservations": {
      get: {
        tags: ["Reservations"],
        summary: "Lista rezerwacji (USER - tylko własne, ADMIN - wszystkie)",
        parameters: [
          { name: "userId", in: "query", schema: { type: "integer", minimum: 1 }, description: "Tylko ADMIN. USER → 403." },
          { name: "roomId", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "buildingId", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "status", in: "query", schema: { type: "string", enum: ["CONFIRMED", "CANCELLED"] } },
          { name: "from", in: "query", schema: { type: "string", format: "date-time" }, description: "Rezerwacje kończące się po from" },
          { name: "to", in: "query", schema: { type: "string", format: "date-time" }, description: "Rezerwacje zaczynające się przed to" },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
          {
            name: "sort", in: "query",
            schema: { type: "string", default: "startTime", enum: ["startTime", "-startTime", "createdAt", "-createdAt", "participants", "-participants"] }
          }
        ],
        responses: {
          200: ok("OK", ref("ReservationList")),
          400: R[400], 401: R[401],
          403: err("USER użył filtra userId (FORBIDDEN)", "FORBIDDEN", "Filter userId is available only for ADMIN")
        }
      },
      post: {
        tags: ["Reservations"],
        summary: "Nowa rezerwacja - właściciel z tokenu",
        requestBody: body("CreateReservationRequest"),
        responses: {
          201: ok("Utworzono", ref("Reservation")),
          400: err("Walidacja (także userId / reservedBy w body) albo zły przedział czasu"),
          401: R[401],
          404: err("Sala nie istnieje", "NOT_FOUND", "Room not found"),
          409: err("ROOM_ALREADY_BOOKED albo ROOM_CAPACITY_EXCEEDED", "ROOM_ALREADY_BOOKED", "Room is already booked in this time range (conflicts with reservation 1)")
        }
      }
    },
    "/api/reservations/{id}": {
      parameters: [idParam("id", "ID rezerwacji")],
      get: {
        tags: ["Reservations"],
        summary: "Jedna rezerwacja (właściciel albo ADMIN)",
        responses: {
          200: ok("OK", ref("Reservation")),
          400: R[400], 401: R[401],
          404: err("Nie istnieje albo należy do innego użytkownika (nie zdradzamy, że istnieje)", "NOT_FOUND", "Reservation not found")
        }
      }
    },
    "/api/reservations/{id}/cancel": {
      parameters: [idParam("id", "ID rezerwacji")],
      patch: {
        tags: ["Reservations"],
        summary: "Anulowanie rezerwacji (właściciel albo ADMIN)",
        responses: {
          200: ok("Anulowano (albo już była anulowana)", ref("Reservation")),
          400: R[400], 401: R[401],
          404: err("Nie istnieje albo należy do innego użytkownika", "NOT_FOUND", "Reservation not found"),
          409: err("RESERVATION_ALREADY_STARTED albo INVALID_STATUS_TRANSITION - obowiązuje także ADMINa", "RESERVATION_ALREADY_STARTED", "Reservation has already started and cannot be cancelled")
        }
      }
    }
  }
};
