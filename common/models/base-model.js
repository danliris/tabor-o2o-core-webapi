'use strict';

var ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID,
    ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

module.exports = function (BaseModel) {
    BaseModel.grindData = grindData;
    BaseModel.sendNotification = sendNotification;
    BaseModel.errorResult = errorResult;

    function grindData(message, payload, filters) {
        return {
            app_id: ONESIGNAL_APP_ID,
            headings: { "en": "JET O2O" },
            contents: { "en": message },
            data: payload,
            filters: filters
        };
    }

    function sendNotification(data) {
        var headers = {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Basic ${ONESIGNAL_API_KEY}`
        };

        var options = {
            host: 'onesignal.com',
            port: 443,
            path: '/api/v1/notifications',
            method: 'post',
            headers: headers,
        };

        var https = require('https');

        var req = https.request(options, function (res) {
            res.on('data', function (data) {
                console.log("Response:");
                console.log(JSON.parse(data));
            });
        });

        req.on('error', function (e) {
            console.log("ERROR:");
            console.log(e);
        });

        req.write(JSON.stringify(data));
        req.end();
    }

    function errorResult(message) {
        var error = new Error();
        error.status = 400;
        error.message = message;

        throw error;
    }
};