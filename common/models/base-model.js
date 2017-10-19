'use strict';
var ONESIGNAL_APP_ID = '92a6e902-5ca5-4b08-ba0b-1d61bea59c7f',
    ONESIGNAL_API_KEY = 'ZDYxYWQ0YTAtYTI0Zi00NjllLTgzOGMtMjg1OWM5MWJjZWYy';

module.exports = function (BaseModel) {
    BaseModel.grindData = grindData;
    BaseModel.sendNotification = sendNotification;

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
};