'use strict';

module.exports = function(Product) {
Product.validatesNumericalityOf('Price', { message: { number: 'not a Number' }});
};
