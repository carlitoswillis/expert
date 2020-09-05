const fs = require('fs');
const util = require('util');
const path = require('path');

const ppt2pdf = require('../node-ppt2pdf-master');

const p2p = util.promisify(ppt2pdf.convert);

module.exports = (cb) => {
  fs.readdir(path.resolve(__dirname, '..', 'uploads'), (err, files) => {
    files = files.filter((f) => f.includes('.ppt'));
    const forLoop = async (_) => {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const options = {
          output: file.split('.ppt')[0], // specified output name (without extension)
          outputdir: path.resolve(__dirname, '..', 'uploads'), // outputdir must be absolute path
          // pagerange: null, // specified page range to be converted, example: '1' or '1-2'
        };
        // eslint-disable-next-line no-await-in-loop
        await p2p(path.resolve(__dirname, '..', 'uploads', file), options);
        console.log('done with', file);
        fs.unlinkSync(path.resolve(__dirname, '..', 'uploads', file));
      }
      console.log('finished converting from ppt to pdf');
      cb();
    };
    forLoop();
  });
};