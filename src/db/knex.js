// Jeden obiekt db (connection pool) na całą aplikację
const knex = require("knex");
const config = require("../../knexfile");

module.exports = knex(config);
