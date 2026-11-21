// Tabela audit_log (zadanie 05) - dziennik eventów. Różne eventy mają różne pola,
// więc payload trzymamy jako jsonb (można go odpytywać: WHERE payload->>'reservationId' = '5').

exports.up = async function (knex) {
  await knex.schema.createTable("audit_log", table => {
    table.bigIncrements("id").primary();
    table.string("event_type", 100).notNullable();
    table.jsonb("payload").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Pod GET /api/admin/audit-log?eventType=... ORDER BY created_at DESC
    table.index(["event_type", "created_at"], "audit_log_event_type_created_at_idx");
    table.index(["created_at"], "audit_log_created_at_idx");
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTable("audit_log");
};
