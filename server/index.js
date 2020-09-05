require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const get = require('../process/drive/getFile');
const db = require('../database');
const bulk = require('../process/bulk');

const app = express();
app.use(bodyParser());
app.use(express.static('dist'));
// app.use(express.static('dist'), (req, res, cb) => {
//   // if (req.headers.referer ? req.headers.referer.toLowerCase().includes('.pdf') : false) fs.unlinkSync(path.resolve(__dirname, '..', 'dist', req.headers.referer.split('/').pop()));
//   cb();
// });

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
    const me = false;
    if (!me) {
      db.readAll(req.query, (err, results) => {
        if (err) throw err;
        res.send(results);
      });
    } else {
      db.deleteResource({ id: req.body.id, query: req.query }, (err, results) => {
        if (err) throw err;
        res.send(results);
      });
    }
  });

app.post('/file', (req, res) => {
  const { fileName, fileID } = req.body;
  get({ fileName, fileID }, (data) => {
    console.log(data);
    res.end();
  });
});
app.delete('/file', (req, res) => {
  const { fileName } = req.body;
  fs.unlinkSync(path.resolve(__dirname, '..', 'dist', fileName));
  res.end();
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

app.listen(3000, (err) => {
  if (err) throw err;
  else console.log('http://localhost:3000');
});
