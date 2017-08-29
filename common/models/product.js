'use strict';

module.exports = function (Product) {
    Product.validatesNumericalityOf('Price', { message: { number: 'not a Number' } });
    Product.validatesUniquenessOf('Code', { message: 'Code Is Already Taken' });


    //convert ke file simpen ke ../images/products/{code}.{extension}
    // Product.Image = ../images/products/{code}.{extension}

    // var fs = require("fs");
    // var path = "common\\images\\products\\test2.jpg";
    // fs.writeFile(path, Product.Image, function (error) {
    //     if (error) {
    //         console.log("write error:  " + error.message);
    //     } else {
    //         console.log("Successful Write to " + path);
    //         Product.Image = path;
    //     }
    // });

    Product.remoteMethod('getAvailable', {
        accepts: {
            arg: 'kioskCode',
            type: 'string'
        },
        http: { path: '/available', verb: 'get' },
        returns: { arg: 'result', type: 'object' }
    });

    Product.getAvailable = function (data, cb) {
        return Product.find(
            {
                include: {
                    
                }
            }
        ).then(function (res) {
            return res;
        });

    }
};
