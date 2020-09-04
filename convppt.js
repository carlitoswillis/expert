const fs = require('fs');
const util = require('util');

const ppt2pdf = require('/Users/carlitoswillis/Downloads/node-ppt2pdf-master');

const p2p = util.promisify(ppt2pdf.convert);

fs.readdir('/Users/carlitoswillis/Downloads/160', (err, files) => {
  files = files.filter((f) => f.includes('.ppt'));
  const forLoop = async (_) => {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const options = {
        output: file.split('.ppt')[0], // specified output name (without extension)
        outputdir: '/Users/carlitoswillis/Downloads/160', // outputdir must be absolute path
        // pagerange: null, // specified page range to be converted, example: '1' or '1-2'
      };
      await p2p(`/Users/carlitoswillis/Downloads/160/${file}`, options);
      console.log('done with', file);
      fs.unlinkSync(`/Users/carlitoswillis/Downloads/160/${file}`);
    }
    console.log('done for real');
  };
  forLoop();
});
