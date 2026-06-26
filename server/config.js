require('dotenv').config();

const path = require('path');

// A record's persisted fields. `id` and `created` are server-managed.
// `type` tags how the source was captured (pdf | web | note | youtube | epub
// | image | audio); `sourceUrl` is its origin (article/video link); `content`
// is the extracted, searchable full text.
const FIELDS = [
  'type',
  'authors',
  'title',
  'content',
  'created',
  'published',
  'url',
  'sourceUrl',
  'fileID',
  'driveLink',
  'fileName',
];

const config = {
  port: Number(process.env.PORT) || 3000,

  // Where the new pure-JS pipeline writes uploaded files.
  uploadDir: process.env.UPLOAD_DIR || path.resolve(__dirname, '..', 'uploads'),

  // JSON store location (used when no MySQL config is present).
  dataDir: process.env.DATA_DIR || path.resolve(__dirname, '..', 'data'),

  // Storage driver: "mysql" if DB_HOST is set, otherwise "json".
  // The JSON store needs zero external services, so the app runs out of the box.
  useMysql: Boolean(process.env.DB_HOST),

  mysql: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB || 'my_db',
    port: Number(process.env.DB_PORT) || 3306,
  },

  fields: FIELDS,
};

module.exports = config;
