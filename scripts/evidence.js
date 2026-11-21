// Zbiera dowody do sprawozdania: wywołuje API i zapisuje requesty + odpowiedzi do sprawozdanie/*.txt
// Użycie (działający server + świeży seed): node scripts/evidence.js
// Hasła z seeda pochodzą z modułu config (.env) - skrypt nie czyta process.env.
const fs = require("node:fs");
const path = require("node:path");
const config = require("../src/config");

const BASE = `http://localhost:${config.port}`;
const OUT = path.join(__dirname, "..", "sprawozdanie");
fs.mkdirSync(OUT, { recursive: true });

async function call(method, url, { token, body, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body !== undefined) h["Content-Type"] = "application/json";
  const res = await fetch(BASE + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* np. 204 */ }
  return { status: res.status, json, text, headers: h };
}

function writer(file) {
  const lines = [];
  return {
    log: (...a) => lines.push(a.join(" ")),
    async show(label, method, url, opts = {}) {
      const r = await call(method, url, opts);
      lines.push(`### ${label}`);
      lines.push(`${method} ${url}`);
      if (opts.token || opts.headers?.Authorization) {
        const auth = opts.headers?.Authorization ?? `Bearer ${opts.token}`;
        lines.push(`Authorization: ${auth.length > 70 ? auth.slice(0, 70) + "..." : auth}`);
      }
      if (opts.body !== undefined) lines.push(JSON.stringify(opts.body));
      lines.push(`--> ${r.status}`);
      if (r.text) lines.push(JSON.stringify(r.json, null, 2) ?? r.text);
      lines.push("");
      return r;
    },
    save: () => fs.writeFileSync(path.join(OUT, file), lines.join("\n") + "\n")
  };
}

const b64 = s => JSON.parse(Buffer.from(s, "base64url").toString());

async function login(email, password) {
  return (await call("POST", "/api/auth/login", { body: { email, password } })).json.accessToken;
}

async function main() {
  const { adminEmail, adminPassword, userPassword } = config.seed;

  // ---------- Zadanie 1 ----------
  const z1 = writer("zad1_rejestracja.txt");
  await z1.show("Rejestracja - 201, email znormalizowany, brak hasha w odpowiedzi", "POST", "/api/auth/register",
    { body: { email: "Jan.Nowy@Example.com", password: "bardzo-dlugie-haslo" } });
  await z1.show("Próba rejestracji z rolą ADMIN - 400", "POST", "/api/auth/register",
    { body: { email: "hacker@example.com", password: "bardzo-dlugie-haslo", role: "ADMIN" } });
  await z1.show("Zbyt krótkie hasło - 400", "POST", "/api/auth/register",
    { body: { email: "krotkie@example.com", password: "short" } });
  await z1.show("Duplikat emaila różniący się wielkością liter - 409 EMAIL_TAKEN", "POST", "/api/auth/register",
    { body: { email: "JAN.NOWY@example.COM", password: "inne-dlugie-haslo" } });

  const parallel = await Promise.all(Array.from({ length: 10 }, () =>
    call("POST", "/api/auth/register", { body: { email: "rownolegle@example.com", password: "bardzo-dlugie-haslo" } })));
  z1.log("### 10 równoległych rejestracji tego samego emaila (rownolegle@example.com)");
  z1.log(parallel.map(r => `${r.status}${r.json?.error ? " " + r.json.error.code : ""}`).join("\n"));
  z1.log("");
  z1.save();

  // ---------- Zadanie 2 ----------
  const z2 = writer("zad2_login_jwt.txt");
  const janToken = await login("jan.kowalski@example.com", userPassword);
  const [h, p] = janToken.split(".");
  z2.log("### POST /api/auth/login { email: jan.kowalski@example.com, password: <SEED_USER_PASSWORD z .env> } --> 200");
  z2.log(JSON.stringify({ accessToken: janToken, tokenType: "Bearer", expiresIn: config.jwt.expiresIn }, null, 2));
  z2.log("");
  z2.log("### Zdekodowany token");
  z2.log("header: " + JSON.stringify(b64(h)));
  const payload = b64(p);
  z2.log("payload: " + JSON.stringify(payload, null, 2));
  z2.log(`iat = ${new Date(payload.iat * 1000).toISOString()}, exp = ${new Date(payload.exp * 1000).toISOString()} (exp - iat = ${payload.exp - payload.iat} s)`);
  z2.log("");
  const badEmail = await z2.show("Zły email - 401", "POST", "/api/auth/login",
    { body: { email: "nie.istnieje@example.com", password: "bardzo-dlugie-haslo" } });
  const badPass = await z2.show("Złe hasło - 401", "POST", "/api/auth/login",
    { body: { email: "jan.kowalski@example.com", password: "zle-haslo-123" } });
  const strip = r => JSON.stringify({ status: r.status, code: r.json.error.code, message: r.json.error.message });
  z2.log("### Porównanie (bez requestId, który jest unikalny dla każdego requestu)");
  z2.log(`zły email: ${strip(badEmail)}`);
  z2.log(`złe hasło: ${strip(badPass)}`);
  z2.log(`identyczne: ${strip(badEmail) === strip(badPass)}`);
  z2.log("");
  await z2.show("GET /api/auth/me - 200, bez hasha", "GET", "/api/auth/me", { token: janToken });
  z2.save();

  // ---------- Zadanie 3 ----------
  const z3 = writer("zad3_401_i_rezerwacje.txt");
  await z3.show("Brak nagłówka Authorization", "GET", "/api/reservations");
  await z3.show("Zły format: Basic", "GET", "/api/reservations", { headers: { Authorization: "Basic YWRtaW46YWRtaW4=" } });
  await z3.show("Zły format: Bearer bez tokenu", "GET", "/api/reservations", { headers: { Authorization: "Bearer" } });
  const i = janToken.length - 5;
  const badSig = janToken.slice(0, i) + (janToken[i] === "A" ? "B" : "A") + janToken.slice(i + 1);
  await z3.show("Zły podpis (zmieniony 1 znak podpisu)", "GET", "/api/reservations", { token: badSig });
  const [hh, pp, ss] = janToken.split(".");
  const evil = Buffer.from(JSON.stringify({ ...b64(pp), role: "ADMIN" })).toString("base64url");
  z3.log(`### Zmodyfikowany payload: ${JSON.stringify({ ...b64(pp), role: "ADMIN" })} + oryginalny podpis`);
  await z3.show("Zmodyfikowany payload (role: ADMIN)", "GET", "/api/buildings", { token: `${hh}.${evil}.${ss}` });
  const none = Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url");
  await z3.show("Token z alg: none (bez podpisu)", "GET", "/api/buildings", { token: `${none}.${pp}.` });
  await z3.show("POST rezerwacji z userId w body - 400", "POST", "/api/reservations",
    { token: janToken, body: { roomId: 2, userId: 3, participants: 5, startTime: "2026-12-15T10:00:00Z", endTime: "2026-12-15T11:00:00Z" } });
  await z3.show("POST rezerwacji z reservedBy w body - 400", "POST", "/api/reservations",
    { token: janToken, body: { roomId: 2, reservedBy: "Anna Nowak", participants: 5, startTime: "2026-12-15T10:00:00Z", endTime: "2026-12-15T11:00:00Z" } });
  await z3.show("POST rezerwacji - 201, user z tokenu", "POST", "/api/reservations",
    { token: janToken, body: { roomId: 2, participants: 5, startTime: "2026-12-15T10:00:00Z", endTime: "2026-12-15T11:00:00Z" } });
  z3.save();

  // ---------- Zadanie 4 - tabela uprawnień ----------
  const adminToken = await login(adminEmail, adminPassword);
  const annaToken = await login("anna.nowak@example.com", userPassword);
  const tokens = { "brak tokenu": null, "USER właściciel": janToken, "USER obcy": annaToken, ADMIN: adminToken };

  // Każdy wiersz: request wykonywany 4x. Właściciel = jan (id 2). Obiekty tworzone na nowo dla każdej kolumny,
  // żeby wynik jednej kolumny (np. anulowanie) nie wpływał na następną.
  let day = 0;
  const futureSlot = () => {
    const d = new Date(Date.now() + (50 + day++) * 24 * 3600 * 1000);
    d.setUTCHours(9, 0, 0, 0);
    return { startTime: d.toISOString(), endTime: new Date(d.getTime() + 3600 * 1000).toISOString() };
  };
  const janReservation = async () =>
    (await call("POST", "/api/reservations", { token: janToken, body: { roomId: 2, participants: 3, ...futureSlot() } })).json.id;
  const tempBuilding = async () =>
    (await call("POST", "/api/buildings", { token: adminToken, body: { name: `Tmp ${Date.now()}-${Math.random()}`, address: "ul. Tymczasowa 1" } })).json.id;

  const rows = [
    ["GET /api/buildings", async () => ["GET", "/api/buildings"]],
    ["GET /api/rooms/:id", async () => ["GET", "/api/rooms/3"]],
    ["POST /api/buildings", async () => ["POST", "/api/buildings", { name: `B ${Date.now()}-${Math.random()}`, address: "ul. Nowa 1" }]],
    ["PATCH /api/buildings/:id", async () => ["PATCH", `/api/buildings/${await tempBuilding()}`, { address: "ul. Zmieniona 1" }]],
    ["DELETE /api/buildings/:id", async () => ["DELETE", `/api/buildings/${await tempBuilding()}`]],
    ["POST /api/rooms", async () => ["POST", "/api/rooms", { buildingId: 3, name: `R${Date.now() % 100000}${Math.floor(Math.random() * 99)}`, capacity: 5 }]],
    ["PATCH /api/rooms/:id", async () => ["PATCH", "/api/rooms/2", { name: "102" }]],
    ["DELETE /api/rooms/:id (sala bez rezerwacji)", async () => {
      const b = await tempBuilding();
      const room = await call("POST", "/api/rooms", { token: adminToken, body: { buildingId: b, name: "X", capacity: 2 } });
      return ["DELETE", `/api/rooms/${room.json.id}`];
    }],
    ["GET /api/reservations", async () => ["GET", "/api/reservations"]],
    ["GET /api/reservations?userId=3", async () => ["GET", "/api/reservations?userId=3"]],
    ["POST /api/reservations", async () => ["POST", "/api/reservations", { roomId: 2, participants: 2, ...futureSlot() }]],
    ["GET /api/reservations/:id (rezerwacja jana)", async () => ["GET", `/api/reservations/${await janReservation()}`]],
    ["PATCH /api/reservations/:id/cancel (rezerwacja jana)", async () => ["PATCH", `/api/reservations/${await janReservation()}/cancel`]]
  ];

  const table = [];
  const details = writer("zad4_tabela_uprawnien_log.txt");
  for (const [label, build] of rows) {
    const cells = [];
    for (const [who, token] of Object.entries(tokens)) {
      const [method, url, body] = await build();
      const r = await call(method, url, { token: token ?? undefined, body });
      const extra = r.json?.error?.code ? ` ${r.json.error.code}` : "";
      const owner = r.json?.data ? ` (rezerwacje userów: ${[...new Set(r.json.data.map(x => x.user.id))].join(",") || "-"})` : "";
      cells.push(`${r.status}`);
      details.log(`[${who.padEnd(15)}] ${method} ${url} --> ${r.status}${extra}${owner}`);
    }
    details.log("");
    table.push([label, ...cells]);
  }
  details.save();

  const header = ["Endpoint", ...Object.keys(tokens)];
  const widths = header.map((hd, c) => Math.max(hd.length, ...table.map(r => r[c].length)));
  const fmt = r => "| " + r.map((x, c) => x.padEnd(widths[c])).join(" | ") + " |";
  const md = [fmt(header), "|" + widths.map(w => "-".repeat(w + 2)).join("|") + "|", ...table.map(fmt)].join("\n");
  fs.writeFileSync(path.join(OUT, "zad4_tabela_uprawnien.md"), md + "\n");
  console.log(md);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
