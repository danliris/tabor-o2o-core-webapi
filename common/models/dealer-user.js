'use strict';

module.exports = function (DealerUser) {
    DealerUser.remoteMethod('mapping', {
        accepts: { arg: 'data', type: 'DealerUser' },
        http: { path: '/mapping', verb: 'post' },
        returns: { arg: 'result', type: 'DealerUser' }
    })

    DealerUser.mapping = function (data, cb) {
        var errors = {};

        var validateEntity = [];

        return new Promise((resolve, reject) => {
            DealerUser.findOne({
                where: { UserId: data.UserId, DealerCode: data.DealerCode, Deleted: false }
            }).then((result) => {
                if (result) {
                    if (!result.Active) {
                        result.updateAttributes({ 'Active': true }).then(
                            updateResult => {
                                resolve(updateResult);
                            }
                        ).catch(updateError => {
                            reject(updateError);
                        })
                    }
                    resolve(result);
                } else {
                    var newDealerUser = {};
                    newDealerUser.UserId = data.UserId;
                    newDealerUser.DealerCode = data.DealerCode;
                    DealerUser.create(newDealerUser).then(
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
