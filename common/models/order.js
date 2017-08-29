'use strict';

module.exports = function (Order) {

    // REMOTE METHODS
    Order.remoteMethod('saveNewOrder', {
        accepts: { arg: 'orderInstance', type: 'object' },
        http: { path: '/Create', verb: 'post' },
        returns: { arg: 'result', type: 'object' }
    });

    Order.remoteMethod('newOrder', {
        accepts: { arg: 'data', type: 'Order' },
        http: { path: '/new', verb: 'post' },
        returns: { arg: 'result', type: 'object' }
    });

    Order.remoteMethod('completeOrder', {
        accepts: { arg: 'data', type: 'object' },
        http: { path: '/complete', verb: 'post' },
        returns: { arg: 'result', type: 'object' }
    });

    // METHODS
    Order.saveNewOrder = function (orderInstance, cb) {
        var order = new Order(orderInstance["order"])
        order.save().then(function (savedOrder, err) {
            savedOrder.orderDetails.create(orderInstance["orderDetails"])
        })
    }

    Order.newOrder = function (data, cb) {

        var order = new Order(data);
        var currentDate = new Date();
        var orderCode = currentDate.getTime().toString(12);

        order.Code = orderCode;
        //order.DealerCode = null;
        order.PIN = '12345';
        order.RequestDate = currentDate;
        order.DeliveryDate = currentDate;
        order.Status = 'CREATED';
        order.PaymentType = 'CASH';

        return order.save()
            .then(function (savedOrder, err) {
                console.log('Order has been created');

                for (var i = 0, j = data.OrderDetails().length; i < j; i++) {
                    var detail = data.OrderDetails()[i];

                    detail.Code = (new Date()).getTime().toString(12);
                    detail.IsRetur = false;
                    detail.IMEI = '';
                    detail.Status = 'CREATED';
                    detail.OrderCode = orderCode;
                    //detail.DealerCode =null;
                    savedOrder.OrderDetails.create(detail);
                }

                console.log('Order details have been created');

                var orderPayment = {
                    OrderCode: orderCode,
                    Amount: data.OrderPayments()[0].Amount,
                    Remark: data.OrderPayments()[0].Remark
                };

                savedOrder.OrderPayments.create(orderPayment);

                console.log('Order payment has been created');

                return order;
            })
            .catch((error) => {
                // console.log(error);

                return error;
            })
            .finally(function () {
            });
    }

    Order.completeOrder = function (data, cb) {

        var orderCode = data.orderCode;

        return Order.findOne({ where: { Code: orderCode, Status: { nlike: 'COMPLETED' } } })
            .then(function (order) {

                if (!order) {
                    return 'This order has been completed';
                }

                order.OrderPayments.create({
                    OrderCode: orderCode,
                    Amount: data.amount,
                    Remark: ''
                });

                order.updateAttribute('Status', 'COMPLETED');

                return order;
            });

    }
};
