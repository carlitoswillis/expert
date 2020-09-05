/* eslint-disable no-shadow */
/* eslint-disable consistent-return */
/* eslint-disable camelcase */
const fs = require('fs');
const { google } = require('googleapis');
const readline = require('readline');
const path = require('path');

const SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly', 'https://www.googleapis.com/auth/drive.file'];
const TOKEN_PATH = path.resolve(__dirname, 'token.json');

const getAccessToken = (oAuth2Client, callback) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
};

const authorize = (credentials, callback, { fileName, fileID }, cb) => {
  const { client_secret, client_id, redirect_uris } = credentials;
  const oAuth2Client = new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0],
  );

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client, { fileName, fileID }, cb);
  });
};

const getFile = (auth, { fileName, fileID }, cb) => {
  const drive = google.drive({ version: 'v3', auth });
  drive.files
    .get({ fileId: fileID, alt: 'media' }, { responseType: 'stream' })
    .then((res) => new Promise((resolve, reject) => {
      const filePath = path.resolve(__dirname, '..', '..', 'dist', `${fileName}`);
      console.log(`writing to ${filePath}`);
      const dest = fs.createWriteStream(filePath);
      let progress = 0;

      res.data
        .on('end', () => {
          console.log('Done downloading file.');
          resolve(filePath);
        })
        .on('error', (err) => {
          console.error('Error downloading file.');
          reject(err);
        })
        .on('data', (d) => {
          progress += d.length;
          if (process.stdout.isTTY) {
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(`Downloaded ${progress} bytes`);
          }
        })
        .pipe(dest);
    }))
    .then((res) => {
      cb(res);
    });
};

module.exports = ({ fileName, fileID }, cb) => {
  fs.readFile(path.resolve(__dirname, 'credentials.json'), (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    authorize(JSON.parse(content.toString()).web, getFile, { fileName, fileID }, cb);
  });
};
