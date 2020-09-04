const pdfExtract = require('pdf-extract');

module.exports = (pdfPath, callback) => {
  if (pdfPath.includes(' ')) throw new Error(`will fail for paths w spaces like ${pdfPath}`);

  const options = {
    type: 'ocr', // perform ocr to get the text within the scanned image
    ocr_flags: ['--psm 1'], // automatically detect page orientation
  };
  const processor = pdfExtract(pdfPath, options, () => console.log('Starting text extraction with OCR'));
  processor.on('complete', (data) => callback(null, data));
  processor.on('error', callback);
};
