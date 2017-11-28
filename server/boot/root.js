'use strict';

// var fetch = require('node-fetch'),
//   JETEXPRESS_AUTH_URL = process.env.JETEXPRESS_AUTH_URL,
//   JETEXPRESS_AUTH_EMAIL = process.env.JETEXPRESS_AUTH_EMAIL,
//   JETEXPRESS_AUTH_PASSWORD = process.env.JETEXPRESS_AUTH_PASSWORD,
//   JETEXPRESS_AUTH_CLIENT_ID = process.env.JETEXPRESS_AUTH_CLIENT_ID;

module.exports = function (server) {
  // Install a `/` route that returns server status
  var router = server.loopback.Router();
  router.get('/', server.loopback.status());
  server.use(router);

  // router.get('/jet-id', (req, res) => {
  //   var options = {
  //     method: 'POST',
  //     headers: { 'content-type': 'application/x-www-form-urlencoded' },
  //     body: `username=${JETEXPRESS_AUTH_EMAIL}&password=${JETEXPRESS_AUTH_PASSWORD}&client_id=${JETEXPRESS_AUTH_CLIENT_ID}&grant_type=password`
  //   };

  //   return fetch(`${JETEXPRESS_AUTH_URL}/oauth/token`, options)
  //     .then(result => {
  //       return result.json();
  //     })
  //     .then(result => {
  //       console.log(result);
  //     })
  //     .catch(err => {
  //       throw err;
  //     });
  // });


  // router.get('/ping', (req, res) => {
  //   res.send('pong');
  // })
};
