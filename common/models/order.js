'use strict';

module.exports = function(Order) {
   Order.remoteMethod('saveNewOrder', {
    accepts: {arg: 'orderInstance', type: 'object'},
    http: {path:'/Create', verb:'post'},
    returns: {arg: 'result', type: 'object'}
    });



    Order.saveNewOrder = function(orderInstance, cb){
    var order = new Order(orderInstance["order"])
    order.save().then(function(savedOrder,err){
    savedOrder.orderDetails.create(orderInstance["orderDetails"])
    })
}
};
