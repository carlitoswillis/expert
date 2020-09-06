const mysql = require('mysql');

const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB || 'my_db',
  port: process.env.DB_PORT || 3306,
});

connection.connect((err) => {
  if (err) console.log(err);
  console.log('connected');
});

// connection.query(`CREATE TABLE if not exists sources(
//   id int AUTO_INCREMENT,
//   authors text,
//   title text,
//   content longtext,
//   created text,
//   published text,
//   url text,
//   fileID text,
//   driveLink text,
//   fileName text,
//   primary key (id)
// )`, (err) => {
//   if (err) console.log(err);
// });

module.exports = connection;

// adad!13D
