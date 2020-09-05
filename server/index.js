require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const db = require('../database');
const bulk = require('../process/bulk');

const app = express();
app.use(bodyParser());
app.use(express.static('dist'));

const storage = multer.diskStorage({
  destination(req, file, cb) {
    if (!req.uploadPath) {
      req.uploadPath = req.uploadPath || path.resolve(__dirname, '..', 'uploads', `${new Date().getTime()}`);
      fs.mkdirSync(req.uploadPath);
    }
    cb(null, req.uploadPath);
  },
  filename(req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage,
}).array('myFile');

app.route('/sources')
  .post((req, res) => {
    upload(req, res, (err) => {
      // console.log(req.body);
      if (err) {
        res.send(err);
      } else {
        // handlePDF({ info: req.body.sourceKeys, extraInfo: req.body.extraInfo }, () => {
        //   fs.unlinkSync(req.body.extraInfo.filePath);
        //   console.log('processed!');
        // });
        bulk(req.uploadPath, null, () => console.log('done for real'));
        res.send('Success, uploaded!');
      }
    });
  })
  .get((req, res) => {
    db.readAll(req.query, (err, results) => {
      if (err) throw err;
      res.send(results);
    });
  })
  .put((req, res) => {
    console.log('hey');
    db.update({ ...req.body }, (err) => {
      if (err) throw err;
      db.readAll(req.query, (err2, results) => {
        if (err2) throw err2;
        res.send(results);
      });
    });
  })
  .delete((req, res) => {
    db.readAll(req.query, (err, results) => {
      if (err) throw err;
      res.send(results);
    });
    // db.deleteResource({ id: req.body.id, query: req.query }, (err, results) => {
    //   if (err) throw err;
    //   res.send(results);
    // });
  });

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});
app.listen(3000, (err) => {
  if (err) throw err;
  else console.log('http://localhost:3000');
});
