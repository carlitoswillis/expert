-- Schema for the MySQL storage driver (server/store/mysqlStore.js).
-- Only needed when DB_HOST is set; the default JSON store needs no DB.
-- Loaded automatically by docker-compose (see /docker-entrypoint-initdb.d).

CREATE DATABASE IF NOT EXISTS my_db;
USE my_db;

CREATE TABLE IF NOT EXISTS sources (
  id        INT AUTO_INCREMENT,
  type      TEXT,            -- pdf | web | note | youtube | epub | image | audio
  authors   TEXT,
  title     TEXT,
  content   LONGTEXT,        -- extracted, searchable full text
  created   TEXT,
  published TEXT,
  url       TEXT,            -- user-supplied reference link
  sourceUrl TEXT,            -- origin of captured content (article/video URL)
  fileID    TEXT,
  driveLink TEXT,
  fileName  TEXT,
  PRIMARY KEY (id)
);
