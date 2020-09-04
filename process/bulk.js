const fs = require('fs');
const path = require('path');
const util = require('util');
const handlePDF = require('./index');
const conv = util.promisify(require('./convppt'));

const hp2 = util.promisify(handlePDF);
const prep = async (course, callback) => {
  await conv();
  const folderPath = path.resolve(__dirname, '..', 'uploads');
  fs.readdir(folderPath, (err, files) => {
    if (err) throw err;
    files = files.filter(f => f.toLowerCase().includes('pdf'));
    const tasks = [];
    files.forEach((fileName) => {
      const fileNameU = fileName.split(' ').join('_');
      if (path.resolve(folderPath, fileName) !== path.resolve(folderPath, fileNameU)) {
        fs.renameSync(path.resolve(folderPath, fileName), path.resolve(folderPath, fileNameU));
      }
      const info = { fileName: course ? `${course} – ${fileName}` : `${fileName}`, created: new Date().toDateString() };
      console.log(path.resolve(__dirname, '..', 'uploads', fileNameU));
      const extraInfo = {
        fileName: fileNameU, filePath: path.resolve(__dirname, '..', 'uploads', fileNameU), ogP: fileName,
      };
      const data = { info, extraInfo };
      tasks.push(data);
    });
    const forLoop = async (_) => {
      for (let index = 0; index < tasks.length; index += 1) {
        const task = tasks[index];
        await hp2(task);
        fs.unlinkSync(path.resolve(__dirname, '..', 'uploads', task.extraInfo.fileName));
        if (index === tasks.length - 1) { callback(null); }
      }
    };
    forLoop();
  });
};

// prep(process.argv[2], process.argv[3]);
module.exports = prep;
