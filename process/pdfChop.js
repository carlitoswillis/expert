const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const mapQs = (quarter) => {
  const dict = {};
  // dict.q1 = (width, height) => [0, 0, width / 2, height / 2];
  // dict.q2 = (width, height) => [width / 2, 0, width / 2, height / 2];
  // dict.q3 = (width, height) => [0, height / 2, width / 2, height / 2];
  // dict.q4 = (width, height) => [width / 2, height / 2, width / 2, height / 2];
  dict.q1 = (width, height) => [0, 0, 40 + width / 2, 40 + height / 2];
  dict.q2 = (width, height) => [width / 2, 0, 40 + width / 2, 40 + height / 2];
  dict.q3 = (width, height) => [0, height / 2, 40 + width / 2, 40 + height / 2];
  dict.q4 = (width, height) => [width / 2, height / 2, 40 + width / 2, 40 + height / 2];
  return dict[quarter];
};

const funky = async (i, idx, sourcePDF, targetDoc) => {
  const [copied2] = await targetDoc
    .copyPages(sourcePDF, [idx]);
  const { width, height } = copied2.getSize();
  copied2.setCropBox(...mapQs(`q${(i % 4) + 1}`)(width, height));
  targetDoc.addPage(copied2);
};

const chop = async (targetPath, callback) => {
  callback(null, true);
  const uint8Array = fs.readFileSync(targetPath);
  const sourcePDF = await PDFDocument.load(uint8Array);
  const pdfDoc2 = await PDFDocument.create();

  const copiedPages = new Array(sourcePDF.getPages().length).fill(0);
  const promises = [];
  copiedPages.forEach((page, index) => {
    for (let i = 0; i < 4; i += 1) {
      promises.push(funky(i, index, sourcePDF, pdfDoc2));
    }
  });
  Promise.all(promises)
    .then(() => {
      const go = async () => {
        const pdfBytes = await pdfDoc2.save();
        fs.writeFileSync(path.resolve(__dirname, '..', 'uploads', `${targetPath.split('/').pop().replace('.pdf', '_')}chopped.pdf`), pdfBytes);
        console.log('chopped pdf into quartiles');
        callback(null);
      };
      go();
    });
};

module.exports = chop;
