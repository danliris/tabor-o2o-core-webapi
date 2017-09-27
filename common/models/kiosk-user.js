'use strict';

module.exports = function (KioskUser) {
    KioskUser.remoteMethod('mapping', {
        accepts: { arg: 'data', type: 'KioskUser' },
        http: { path: '/mapping', verb: 'post' },
        returns: { arg: 'result', type: 'KioskUser' }
    })

    KioskUser.mapping = function (data, cb) {
        var errors = {};

        var validateEntity = [];

        return new Promise((resolve, reject) => {
            KioskUser.findOne({
                where: { UserId: data.UserId, KioskCode: data.KioskCode, Deleted: false }
            }).then((result) => {
                if (result) {
                    if (!result.Active) {
                        result.updateAttributes({'Active': true}).then(
                            updateResult => {
                                resolve(updateResult);
                            }
                        ).catch(updateError => {
                            reject(updateError);
                        })
                    }
                    resolve(result);
                } else {
                    var newKioskUser = {};
                    newKioskUser.UserId = data.UserId;
                    newKioskUser.KioskCode = data.KioskCode;
                    KioskUser.create(newKioskUser).then(
                        insertResult => {
                            resolve(insertResult);
                        }
                    ).catch(insertError => {
                        reject(insertError);
                    });
                }
            });
        })
    }
};
