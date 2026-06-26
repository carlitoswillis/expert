const mysql = require('mysql2/promise');

const { mysql: dbConfig, fields } = require('../config');

// Production store. Uses mysql2 with a promise pool and *parameterized* queries
// everywhere (the original implementation interpolated user input straight into
// SQL strings — a textbook injection hole). Schema lives in database/schema.sql.

const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
});

const LIST_COLUMNS = 'id, authors, title, created, published, url, fileID, fileName';

function buildWhere(query) {
  const { q, authors, title, fileName, content } = query;
  if (q) {
    const like = `%${q}%`;
    return {
      clause: ' WHERE content LIKE ? OR title LIKE ? OR authors LIKE ? OR fileName LIKE ?',
      params: [like, like, like, like],
    };
  }
  const parts = [['authors', authors], ['title', title], ['fileName', fileName], ['content', content]]
    .filter(([, value]) => value);
  if (!parts.length) return { clause: '', params: [] };
  return {
    clause: ` WHERE ${parts.map(([col]) => `${col} LIKE ?`).join(' AND ')}`,
    params: parts.map(([, value]) => `%${value}%`),
  };
}

async function list(query = {}) {
  const page = Number(query.page) || 0;
  const limit = Number(query.limit) || 10;
  const offset = page * limit;
  const { clause, params } = buildWhere(query);

  const [rows] = await pool.query(
    `SELECT ${LIST_COLUMNS} FROM sources${clause} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count FROM sources${clause}`,
    params,
  );
  return { results: rows, count };
}

async function get(id) {
  const [rows] = await pool.query('SELECT * FROM sources WHERE id = ?', [id]);
  return rows[0] || null;
}

async function create(record) {
  const columns = Object.keys(record).filter((c) => fields.includes(c));
  const values = columns.map((c) => record[c]);
  const placeholders = columns.map(() => '?').join(', ');
  const [result] = await pool.query(
    `INSERT INTO sources (${columns.join(', ')}) VALUES (${placeholders})`,
    values,
  );
  return { id: result.insertId, ...record };
}

async function update(id, patch) {
  const columns = Object.keys(patch).filter((c) => fields.includes(c));
  if (!columns.length) return get(id);
  const assignments = columns.map((c) => `${c} = ?`).join(', ');
  const values = columns.map((c) => patch[c]);
  await pool.query(`UPDATE sources SET ${assignments} WHERE id = ?`, [...values, id]);
  return get(id);
}

async function remove(id) {
  const [result] = await pool.query('DELETE FROM sources WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

module.exports = { list, get, create, update, remove, driver: 'mysql', pool };
