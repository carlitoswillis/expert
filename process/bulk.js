const fs = require('fs');
const path = require('path');
const util = require('util');
const handlePDF = require('./index');

const hp2 = util.promisify(handlePDF);
const prep = (course, callback) => {
  const folderPath = '/Users/carlitoswillis/local/programming/expert/uploads/';
  fs.readdir(folderPath, (err, files) => {
    if (err) throw err;
    files = files.filter(f => f.toLowerCase().includes('pdf'));
    const tasks = [];
    files.forEach((fileName) => {
      const fileNameU = fileName.split(' ').join('_');
      fs.copyFileSync(path.resolve(folderPath, fileName), path.resolve(__dirname, fileNameU));
      const info = { fileName: course ? `${course} – ${fileName}` : `${fileName}`, created: new Date().toDateString() };
      const extraInfo = {
        fileName: fileNameU, filePath: path.resolve(__dirname, fileNameU), ogP: fileName,
      };
      const data = { info, extraInfo };
      tasks.push(data);
    });
    const forLoop = async (_) => {
      for (let index = 0; index < tasks.length; index += 1) {
        const task = tasks[index];
        await hp2(task);
        fs.unlinkSync(path.resolve(__dirname, '..', 'uploads', task.extraInfo.fileName));
        fs.unlinkSync(path.resolve(folderPath, task.extraInfo.ogP));
      }
      console.log('done for real');
    };
    forLoop();
    callback();
  });
};

// prep(process.argv[2], process.argv[3]);

module.exports = prep;
