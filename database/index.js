const con = require('./myConfig');

const getCount = (query, callback) => {
  const qstr = query.replace('id, authors, title, created, published, url, fileID, fileName', 'count(*)');
  con.query(qstr, (err, result) => {
    if (err) throw err;
    callback(null, result);
  });
};

const readAll = (query, callback) => {
  console.log(query);
  const {
    limit, page, q, authors, title, fileName, content,
  } = query;
  const offset = page * limit;
  let qstr = 'select id, authors, title, created, published, url, fileID, fileName from sources';
  let qforcount = qstr;
  let addStr = '';
  if (q) {
    addStr = ` where content like '%${q}%' or title like '%${q}%' or authors like '%${q}%' or fileName like '%${q}%'`;
  } else {
    const parts = [['authors', authors], ['title', title], ['fileName', fileName], ['content', content]];
    const qstrA = [];
    parts.forEach((kp) => {
      if (kp[1]) qstrA.push(`${kp[0]} like '%${kp[1]}%'`);
    });
    addStr = qstrA.join(' and ') ? ` where ${qstrA.join(' and ')}` : '';
  }
  qstr = qstr.concat(addStr, ` order by id desc limit ${offset}, ${limit}`);
  qforcount = qforcount.concat(addStr);
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
