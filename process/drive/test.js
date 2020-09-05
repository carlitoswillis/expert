const get = require('./getFile');

get({ fileName: 'Goldstein Ch1.pdf', fileID: '1qMY5Hr2DlTwwlHRJbqGkXuOPNquveWZg' }, (data) => {
  console.log(data);
});

// const create = require('./create');

// create('/Users/carlitoswillis/Downloads/160/Goldstein Ch1.pdf', (data) => {
//   console.log(data);
// });
