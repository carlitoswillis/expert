const pdfExtract = require('pdf-extract');

module.exports = (pdfPath, callback) => {
  if (pdfPath.includes(' ')) throw new Error(`will fail for paths w spaces like ${pdfPath}`);
  const options = {
    type: 'text', // extract searchable text from PDF
    ocr_flags: ['--psm 1'], // automatically detect page orientation
    enc: 'UTF-8', // optional, encoding to use for the text output
    mode: 'layout', // optional, mode to use when reading the pdf
  };
  const processor = pdfExtract(pdfPath, options, () => console.log('Starting text extraction'));
  processor.on('complete', (data) => callback(null, data));
  processor.on('error', callback);
};
