const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const db = require('../database');
const handlePDF = require('../process');
const bulk = require('../process/bulk');

const app = express();
app.use(express.json());
app.use(bodyParser());
app.use(express.static('dist'));

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'uploads');
  },
  filename(req, file, cb) {
    const keys = Object.keys(req.body);
    req.body.extraInfo = { fileName: file.originalname.split(' ').join('_') };
    const { extraInfo } = req.body;
    req.body.sourceKeys = { fileName: file.originalname };
    extraInfo.filePath = path.resolve(__dirname, '..', 'uploads', extraInfo.fileName);
    keys.forEach((key) => {
      req.body.sourceKeys[key] = req.body[key];
    });
    req.body.sourceKeys.created = new Date().toDateString();
    console.log(file.originalname);
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage,
}).array('myFile');

app.route('/sources')
  .post((req, res) => {
    upload(req, res, (err) => {
      if (err) {
        res.send(err);
      } else {
        // handlePDF({ info: req.body.sourceKeys, extraInfo: req.body.extraInfo }, () => {
        //   fs.unlinkSync(req.body.extraInfo.filePath);
        //   console.log('processed!');
        // });
        bulk(null, () => console.log('aye'));
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
    res.end('you are not authorized');
  })
  .delete((req, res) => {
    res.end('you are not authorized');
  });

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});
app.listen(3000, (err) => {
  if (err) throw err;
  else console.log('http://localhost:3000');
});
