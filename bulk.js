const fs = require('fs');
const path = require('path');
const util = require('util');
const handlePDF = require('./process');

const hp2 = util.promisify(handlePDF);
const prep = (folderPath, course) => {
  fs.readdir(folderPath, (err, files) => {
    if (err) throw err;
    files = files.filter(f => f.toLowerCase().includes('pdf'));
    const tasks = [];
    files.forEach((fileName) => {
      const fileNameU = fileName.split(' ').join('_');
      fs.copyFileSync(path.resolve(folderPath, fileName), path.resolve(__dirname, 'uploads', fileNameU));
      const info = { fileName: course ? `${course} – ${fileName}` : `${fileName}`, created: new Date().toDateString() };
      const extraInfo = { fileName: fileNameU, filePath: path.resolve(__dirname, 'uploads', fileNameU), ogP: fileName };
      const data = { info, extraInfo };
      tasks.push(data);
    });
    const forLoop = async (_) => {
      for (let index = 0; index < tasks.length; index += 1) {
        const task = tasks[index];
        await hp2(task);
        fs.unlinkSync(path.resolve(__dirname, 'uploads', task.extraInfo.fileName));
        fs.unlinkSync(path.resolve(folderPath, task.extraInfo.ogP));
      }
      console.log('done for real');
    };
    forLoop();
  });
};

prep(process.argv[2], process.argv[3]);
