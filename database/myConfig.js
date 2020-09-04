const mysql = require('mysql');

const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: '',
  database: 'my_db',
});

connection.connect();

module.exports = connection;

// adad!13D
