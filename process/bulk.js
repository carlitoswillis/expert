const fs = require('fs');
const path = require('path');
const util = require('util');
const handlePDF = require('./index');
const convSingle = util.promisify(require('./convpptSingle'));

const hp2 = util.promisify(handlePDF);
const prep = async (folderPath, course, callback) => {
  // const folderPath = path.resolve(__dirname, '..', 'uploads');
  fs.readdir(folderPath, (err, files) => {
    if (err) throw err;
    files = files.filter(f => f.toLowerCase().includes('pdf') || f.toLowerCase().includes('ppt'));
    const tasks = [];
    files.forEach((fileName) => {
      const fileNameU = fileName.split(' ').join('_');
      if (path.resolve(folderPath, fileName) !== path.resolve(folderPath, fileNameU)) {
        fs.renameSync(path.resolve(folderPath, fileName), path.resolve(folderPath, fileNameU));
      }
      const info = { fileName: course ? `${course} – ${fileName.replace('ppt', 'pdf')}` : `${fileName.replace('ppt', 'pdf')}`, created: new Date().toDateString() };
      const extraInfo = {
        fileName: fileNameU.replace('ppt', 'pdf'),
        filePath: path.resolve(folderPath.split(fileName)[0], fileNameU),
        ogP: fileName,
      };
      const data = { info, extraInfo };
      tasks.push(data);
    });
    const forLoop = async (_) => {
      for (let index = 0; index < tasks.length; index += 1) {
        const task = tasks[index];
        await convSingle(task.extraInfo.filePath);
        task.extraInfo.filePath = task.extraInfo.filePath.replace('ppt', 'pdf');
        await hp2(task);
        console.log('done with, ', task.extraInfo.fileName);
      }
      fs.rmdirSync(folderPath);
      callback(null);
    };
    forLoop();
  });
};

// prep(process.argv[2], process.argv[3]);
module.exports = prep;
