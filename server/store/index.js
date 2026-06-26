const { useMysql } = require('../config');

// Pick a storage driver at startup. Set DB_HOST in the environment to use
// MySQL; otherwise everything is kept in a local JSON file (zero setup).
// eslint-disable-next-line global-require
const store = useMysql ? require('./mysqlStore') : require('./jsonStore');

module.exports = store;
