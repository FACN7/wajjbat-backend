const db = require("../database/db_connection");

const getaUserById = id => db.query("SELECT * FROM users WHERE id=$1", [id]);

module.exports = { getaUserById };
