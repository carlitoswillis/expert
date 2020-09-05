const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const util = require('util');

const text = require('./text');
const ocr = require('./ocr');
const chop = require('./pdfChop');
const db = require('../database');
const create = util.promisify(require('./drive/create'));

module.exports = ({ info, extraInfo }, callback) => {
  const { fileName, filePath } = extraInfo;
  const title = info.title || fileName;
  create(filePath, (fileID) => {
    info.fileID = fileID;
    text(filePath, (err2, data) => {
      if (err2) {
        console.error(err2);
      }
      const jsonPath = path.resolve(__dirname, '..', 'infoToProcess', `${title}.json`);
      if (!data || !data.text_pages || data.text_pages[0].length < 20) {
        const textFilePath = path.resolve(__dirname, '..', `${filePath.split('/').pop()}.txt`);
        let convertioCalled = false;
        const convertio = () => {
          console.log('failed to extract text, trying convertio');
          convertioCalled = true;
          const convertioCommand = `convertio -f txt "${filePath}"`;
          cp.execSync(convertioCommand);
          data = fs.readFileSync(textFilePath)
            .toString()
            .replace(/\s+/g, ' ')
            .trim()
            .split('- ')
            .join('');
        };
        // convertio();
        if (convertioCalled ? data.length < 20 : true) {
          console.log('no data parsed, chopping pdf and scanning with OCR');
          chop(filePath, (err, notChopped) => {
            const choppedPath = notChopped ? filePath : path.resolve(__dirname, '..', 'uploads', `${filePath.split('/').pop().replace('.pdf', '_')}chopped.pdf`);
            console.log(choppedPath);
            ocr(choppedPath, (err3, data2) => {
              if (err3) throw err3;
              fs.writeFile(jsonPath, JSON.stringify({
                ...info,
                content: data2.text_pages
                  .reduce((x, y) => x.concat(y))
                  .replace(/\s+/g, ' ')
                  .trim()
                  .split('- ')
                  .join(''),
              }), (err4) => {
                if (err4) throw err4;
                const entry = JSON.parse(fs.readFileSync(jsonPath));
                db.create(entry, (createErr, result2) => {
                  if (createErr) throw createErr;
                  fs.unlinkSync(jsonPath);
                  if (!notChopped) fs.unlinkSync(choppedPath);
                  fs.unlinkSync(filePath);
                  callback(null, result2);
                });
              });
            });
          });
        } else {
          console.log('data parsed with convertio');
          const entry = { ...info, content: data };
          db.create(entry, (createErr, result2) => {
            if (createErr) throw createErr;
            fs.unlinkSync(textFilePath);
            fs.unlinkSync(filePath);
            callback(null, result2);
          });
        }
      } else {
        fs.writeFile(jsonPath, JSON.stringify({
          ...info, content: data.text_pages.reduce((x, y) => x.concat(y))
          ,
        }), (err5) => {
          if (err5) throw err5;
          const entry = JSON.parse(fs.readFileSync(jsonPath));
          db.create(entry, (createErr, result3) => {
            if (createErr) throw createErr;
            fs.unlinkSync(jsonPath);
            fs.unlinkSync(filePath);
            callback(null, result3);
          });
        });
      }
    });
  });
};
