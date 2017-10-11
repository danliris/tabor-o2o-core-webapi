'use strict';

module.exports = function (VMappedProduct) {
    VMappedProduct.remoteMethod('test', {
        http: { path: '/test', verb: 'get' },
        returns: { arg: 'result', type: 'object' }
    });

    VMappedProduct.test = function (cb) {
        return VMappedProduct.find({
            fields: {
                Code: true,
                ProductCategoryCode: false,
                ProductCategoryName: false
            },
            distinct: true
        });
    }
};
