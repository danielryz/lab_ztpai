// Ostatnia linia obrony przed double booking: baza nie pozwoli na dwie nakładające się
// rezerwacje CONFIRMED tej samej sali. '[)' = przedział półotwarty, więc 10-12 i 12-13 się NIE nakładają.

exports.up = async function (knex) {
  await knex.raw(`CREATE EXTENSION IF NOT EXISTS btree_gist`);
  await knex.raw(`
    ALTER TABLE reservations
      ADD CONSTRAINT reservations_no_overlap
      EXCLUDE USING gist (
        room_id WITH =,
        tstzrange(start_time, end_time, '[)') WITH &&
      )
      WHERE (status = 'CONFIRMED')
  `);
};

exports.down = async function (knex) {
  await knex.raw(`ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_no_overlap`);
  await knex.raw(`DROP EXTENSION IF EXISTS btree_gist`);
};
