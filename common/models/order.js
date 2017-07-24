'use strict';

module.exports = function (Order) {
    Order.remoteMethod('saveNewOrder', {
        accepts: { arg: 'orderInstance', type: 'object' },
        http: { path: '/Create', verb: 'post' },
        returns: { arg: 'result', type: 'object' }
    });

    
    Order.remoteMethod('newOrder', {
        accepts: { arg: 'data', type: 'object' },
        http: { path: '/new', verb: 'post' },
        returns: { arg: 'result', type: 'object' }
    });

    Order.saveNewOrder = function (orderInstance, cb) {
        var order = new Order(orderInstance["order"])
        order.save().then(function (savedOrder, err) {
            savedOrder.orderDetails.create(orderInstance["orderDetails"])
        })
    }

    Order.newOrder = function (data, cb) {
        var order = new Order(data["order"]);

        var orderCode = (new Date()).getTime().toString(12);

        order.Code = orderCode;
        order.Discount = 0;
        order.DiscountNominal = 0;
        order.RequestDate = new Date();
        order.TotalQty = order.OrderDetails.length;
        order.Status = 'NEW';

        for (var i = 0, j = order.OrderDetails.length; i < j; i++) {

            order.OrderDetails.IMEI = '';
            order.OrderDetails[i].OrderCode = orderCode;
        }

        order
            .save()
            .then(function (savedOrder, err) {
                savedOrder.orderDetails.create(order.OrderDetails);
            })
            .catch((error) => {
                console.log(error);
            })
            .finally(function () {

            });
    }
};
