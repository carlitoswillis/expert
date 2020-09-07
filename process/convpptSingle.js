const fs = require('fs');
const util = require('util');
const path = require('path');

const ppt2pdf = require('../node-ppt2pdf-master');

const p2p = util.promisify(ppt2pdf.convert);

module.exports = (filePath, cb) => {
  if (!filePath.includes('.ppt')) {
    cb();
  } else {
    console.log('starting to convert', filePath.split('/').pop());
    const fp = filePath.split('/');
    fp.pop();
    const options = {
      output: filePath.split('/').pop().split('.ppt')[0], // specified output name (without extension)
      outputdir: fp.join('/'), // outputdir must be absolute path
      // pagerange: null, // specified page range to be converted, example: '1' or '1-2'
    };
    p2p(filePath, options, (err) => {
      if (err) throw err;
      console.log('removing...');
      fs.unlinkSync(filePath);
      console.log('done with', filePath.split('/').pop());
      cb();
    });
}
};
