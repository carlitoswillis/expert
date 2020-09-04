USE my_db;

CREATE TABLE if not exists sources(
  id int AUTO_INCREMENT,
  authors text,
  title text,
  content longtext,
  created text,
  published text,
  url text,
  fileID text,
  driveLink text,
  fileName text,
  primary key (id)
);
