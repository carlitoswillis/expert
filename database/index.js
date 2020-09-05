const con = require('./myConfig');

const getCount = (query, callback) => {
  const qstr = query.replace('*', 'count(*)');
  con.query(qstr, (err, result) => {
    if (err) throw err;
    callback(null, result);
  });
};

const readAll = (query, callback) => {
  const { limit, page, q } = query;
  const offset = page * limit;
  let qstr = 'select * from sources';
  let qforcount = qstr;
  if (q) {
    const addStr = !q.includes(':')
      ? ` where content like '%${q}%' or title like '%${q}%' or authors like '%${q}%'`
      : ` where ${q.split(':')[0]} like '%${q.split(':')[1]}%'`;
    qstr = qstr.concat(addStr);
    qforcount = qforcount.concat(addStr);
  }
  qstr = qstr.concat(` order by id desc limit ${offset}, ${limit}`);
  con.query(qstr, (err, result) => {
    if (err) throw err;
    getCount(qforcount, (ce, count) => {
      callback(null, { results: result, count: count[0]['count(*)'] });
    });
  });
};

const create = (info, callback) => {
  const columns = Object.keys(info);
  const values = columns.map((x) => info[x]);
  let qstring = '';
  columns.forEach(() => {
    qstring += '?, ';
  });
  qstring = qstring.slice(0, qstring.length - 2);
  const query = `INSERT INTO sources (${columns.join()}) VALUES (${qstring})`;
  con.query(query, values, (err, result) => {
    if (err) throw err;
    callback(null, result);
  });
};

const update = (info, callback) => {
  const columns = Object.keys(info);
  const values = columns.map((x) => info[x]);
  let qstring = '';
  columns.forEach((x) => {
    qstring += `${x} = '${info[x]}', `;
  });
  qstring = qstring.slice(0, qstring.length - 2);
  const query = `UPDATE sources SET ${qstring} WHERE id = '${info.id}'`;
  con.query(query, values, (err, result) => {
    if (err) throw err;
    callback(null, result);
  });
};

const deleteResource = ({ id, query }, callback) => {
  con.query('DELETE from sources where id = ?', [id], (err) => {
    if (err) throw err;
    readAll(query, (e2, results) => {
      if (e2) throw e2;
      callback(null, results);
    });
  });
};

module.exports = {
  create, readAll, update, deleteResource,
};
