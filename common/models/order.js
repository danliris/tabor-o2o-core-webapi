'use strict';

module.exports = function (Order) {

    Order.remoteMethod('createDraft', {
        accepts: { arg: 'data', type: 'object' },
        http: { path: '/draft', verb: 'post' },
        returns: { arg: 'result', type: 'Order' }
    });

    Order.remoteMethod('updateDraft', {
        accepts: { arg: 'data', type: 'object', 'required': true },
        http: { path: '/draft', verb: 'put' },
        returns: { arg: 'result', type: 'Order' }
    });

    Order.remoteMethod('payment', {
        accepts: { arg: 'data', type: 'OrderPayment' },
        http: { path: '/payment', verb: 'post' },
        returns: { arg: 'result', type: 'Order' }
    });

    // Order.remoteMethod('updatePaymentStatus', {
    //     accepts: { arg: 'code', type: 'string' },
    //     http: { path: '/payment-status', verb: 'post' },
    //     returns: { arg: 'result', type: 'Order' }
    // });

    Order.remoteMethod('completeOrder', {
        accepts: { arg: 'code', type: 'string' },
        http: { path: '/complete', verb: 'post' },
        returns: { arg: 'result', type: 'Order' }
    });

    Order.remoteMethod('voidDraft', {
        accepts: { arg: 'code', type: 'string' },
        http: { path: '/void', verb: 'post' },
        returns: { arg: 'result', type: 'Order' }
    });

    Order.remoteMethod('arriveOrder', {
        accepts: { arg: 'code', type: 'string' },
        http: { path: '/arrive', verb: 'post' },
        returns: { arg: 'result', type: 'Order' }
    });

    Order.createDraft = function (data, cb) {
        var promises = [];
        return populateData(Order, data)
            .then(order => {
                return (new Order(order))
                    .save()
                    .then((_orderSaved, err) => {
                        for (var i = 0, length = order.OrderDetails.length; i < length; i++) {
                            promises.push(
                                _orderSaved.OrderDetails
                                    .create(order.OrderDetails[i])
                                    .then((_orderSavedDetail) => {
                                        _orderSavedDetail.OrderTracks
                                            .create(order.OrderDetails[0].OrderTracks[0]);
                                    })
                            );
                        }

                        return Promise.all(promises)
                            .then(response => {
                                return _orderSaved;
                            });
                    });
            });
    }

    Order.updateDraft = function (data, cb) {
        var promises = [];

        return populateData(Order, data, true)
            .then(order => {
                return Order.upsert(order)
                    .then((_orderSaved, err) => {
                        for (var i = 0, length = order.OrderDetails.length; i < length; i++) {
                            promises.push(Order.app.models.OrderDetail.upsert(order.OrderDetails[i]));
                        }

                        return Promise.all(promises)
                            .then(response => {
                                return _orderSaved;
                            });
                    });
            });
    }

    Order.payment = function (data, cb) {
        // kalo out of stock
        return getOrderWithDetails(Order, data.OrderCode)
            .then(order => {
                if (order == null)
                    throw 'Not found / Invalid Status';

                if (order.IsFullyPaid)
                    throw 'Order has been fully paid';

                if (order.Status != 'DRAFTED' && order.Status != 'ARRIVED')
                    throw 'Invalid status';

                return order.OrderPayments
                    .create({
                        TransactionDate: new Date(),
                        PaymentMethod: 'CASH',
                        PaymentType: data.PaymentType,
                        Amount: data.Amount,
                        PaidAmount: data.PaidAmount,
                        Remark: '-'
                    })
                    .then(orderPayment => {
                        var promises = [];
                        promises.push(updatePaymentStatus(order));
                        // update stock
                        promises.push(updateProductStock(Order, order));

                        return Promise.all(promises)
                            .then(res => {
                                return getOrderWithDetails(Order, order.Code)
                                    .then(order => {
                                        return order;
                                    });
                            });
                    });
            })
    }

    // Order.updatePaymentStatus = function (code, cb) {
    //     return getOrderWithDetails(Order, code)
    //         .then(order => {
    //             if (order == null) {
    //                 throw 'Not found / Invalid Status';
    //             }

    //             if (order.Status != 'DRAFTED' && order.Status != 'ARRIVED')
    //                 throw `Invalid Status: ${order.Status}`;

    //             var totalPaidAmount = order.OrderPayments().reduce(function (a, b) {
    //                 return b.Amount + a;
    //             }, 0);

    //             // lunas?
    //             var isFullyPaid = totalPaidAmount >= order.TotalPrice + order.TotalShippingFee;

    //             var nextStatus = '';
    //             if (order.Status == 'DRAFTED')
    //                 nextStatus = 'REQUESTED';
    //             else if (order.Status == 'ARRIVED')
    //                 nextStatus = 'RECEIVED';

    //             return updateOrderStatus(order, nextStatus);
    //         });
    // }

    Order.voidDraft = function (code, cb) {
        return getOrderWithDetails(Order, code)
            .then(order => {
                if (order == null)
                    throw 'Not found';

                if (order.Status != 'DRAFTED')
                    throw `Invalid Status: ${order.Status}`;

                return updateOrderStatus(order, 'VOID');
            });
    }

    Order.arriveOrder = function (code, cb) {
        return getOrderWithDetails(Order, code)
            .then(order => {
                if (order == null)
                    throw 'Not found';

                if (order.Status != 'DELIVERED')
                    throw `Invalid Status: ${order.Status}`;

                return updateOrderStatus(order, 'ARRIVED');
            });
    }

    Order.completeOrder = function (code, cb) {
        return getOrderWithDetails(Order, code)
            .then(order => {
                if (order == null)
                    throw 'Not found';

                if (order.Status != 'ARRIVED')
                    throw `Invalid Status: ${order.Status}`;

                return updateOrderStatus(order, 'COMPLETED');
            });
    }

    function updateProductStock(Order, order) {
        var promises = [];
        for (var i = 0, length = order.OrderDetails().length; i < length; i++) {
            var detail = order.OrderDetails()[i];
            promises.push(
                Order.app.models.ProductDealer.findOne({
                    where: {
                        ProductCode: detail.ProductCode,
                        DealerCode: detail.DealerCode
                    }
                })
                    .then(product => {
                        product.Quantity -= detail.Quantity;
                        product.save();
                    })
            );
        }
        Promise.all(promises)
            .then(res => {

            });
    }

    function updatePaymentStatus(order) {
        var totalPaidAmount = order.OrderPayments().reduce(function (a, b) {
            return b.Amount + a;
        }, 0);

        // lunas?
        var isFullyPaid = totalPaidAmount >= order.TotalPrice + order.TotalShippingFee;

        return order.updateAttribute('IsFullyPaid', isFullyPaid)
            .then(res => {

                var nextStatus = '';
                if (order.Status == 'DRAFTED')
                    nextStatus = 'REQUESTED';
                // else if (order.Status == 'ARRIVED')
                //     nextStatus = 'RECEIVED';

                return updateOrderStatus(order, nextStatus);
            });
    }

    function getOrderWithDetails(Order, code) {
        return Order.findOne({
            include: ['OrderDetails', 'OrderPayments'],
            where: { Code: code }
        });
    }

    function updateOrderStatus(order, status) {
        var currentDate = new Date();
        var promises = [];

        promises.push(order.updateAttribute('Status', status));

        promises.push(order.OrderDetails.updateAll({}, { 'Status': status }, function (err, info, count) { }));

        for (var i = 0, length = order.OrderDetails().length; i < length; i++) {
            promises.push(
                order.OrderDetails()[i].OrderTracks
                    .create({
                        OrderCode: order.OrderDetails()[i].OrderCode,
                        OrderDetailCode: order.OrderDetails()[i].Code,
                        TrackDate: currentDate,
                        Status: status,
                        Remark: '-'
                    })
            );
        }

        return Promise.all(promises)
            .then(res => {
                return res[0];
            });
    }

    function IDGenerator() {
        this.length = 8;
        this.timestamp = +new Date;

        var _getRandomInt = function (min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        this.generate = function () {
            var ts = this.timestamp.toString();
            var parts = ts.split("").reverse();
            var id = "";

            for (var i = 0; i < this.length; ++i) {
                var index = _getRandomInt(0, parts.length - 1);
                id += parts[index];
            }

            return id;
        }
    }

    function generatePIN() {
        return Math.floor(Math.random() * 89999 + 10000);
    }

    function getVMappedProduct(Order, productCode, dealerCode) {
        return Order.app.models.VMappedProduct
            .findOne({
                where: {
                    Code: productCode,
                    DealerCode: dealerCode
                }
            });
    }

    function getVMappedProductsByDetail(Order, data) {
        var promises = [];
        for (var i = 0, length = data.OrderDetails.length; i < length; i++) {
            var detail = data.OrderDetails[i];
            promises.push(getVMappedProduct(Order, detail.ProductCode, detail.DealerCode));
        }

        return Promise.all(promises)
            .then(res => {
                return res;
            });
    }

    function populateData(Order, data, isUpdate = false) {
        return getVMappedProductsByDetail(Order, data)
            .then(res => {
                var products = res;

                var status = 'DRAFTED',
                    currentDate = new Date(),
                    idGenerator = new IDGenerator();

                var order = {
                    Code: !isUpdate ? idGenerator.generate() : data.Code,
                    KioskCode: data.KioskCode,
                    IdCard: data.IdCard,
                    Name: data.Name,
                    Email: data.Email,
                    RequestDate: currentDate,
                    Latitude: 0,
                    Longitude: 0,
                    SelfPickUp: data.SelfPickUp,
                    Address: data.Address,
                    Phone: data.Phone,
                    PIN: !isUpdate ? generatePIN() : data.PIN,
                    DP: 0, // calculate later
                    TotalQuantity: 0, // calculate later
                    TotalPrice: 0, // calculate later
                    TotalWeight: 0, // calcluate later
                    ShippingDestination: data.ShippingDestination,
                    ShippingProductCode: data.ShippingProductCode,
                    ShippingDueDay: data.ShippingDueDay,
                    TotalShippingFee: data.TotalShippingFee, // calculate later
                    IsFullyPaid: false,
                    Status: status,
                    OrderDetails: []
                };

                for (var i = 0, length = data.OrderDetails.length; i < length; i++) {
                    var detail = data.OrderDetails[i],
                        product = products.find(x =>
                            x.Code == detail.ProductCode &&
                            x.DealerCode == detail.DealerCode);

                    if (detail.Quantity > product.Quantity)
                        throw 'Insufficient stocks.';

                    var orderDetail = {
                        Code: !isUpdate ? idGenerator.generate() : detail.Code,
                        OrderCode: order.Code,
                        ProductCode: detail.ProductCode,
                        DealerCode: detail.DealerCode,
                        Quantity: detail.Quantity,
                        ShippingFee: 0, // calculate later
                        IsRetur: false,
                        Status: status,
                        Price: product.Price * detail.Quantity,
                        DPNominal: (product.DP / 100) * product.Price * detail.Quantity,
                        Weight: product.Weight * detail.Quantity,
                        RequestDate: order.RequestDate,
                        OrderTracks: []
                    };

                    // add track
                    if (!isUpdate) {
                        var orderTrack = {
                            OrderCode: orderDetail.OrderCode,
                            OrderDetailCode: orderDetail.Code,
                            TrackDate: currentDate,
                            Status: status,
                            Remark: ''
                        };

                        orderDetail.OrderTracks.push(orderTrack);
                    }

                    // update header
                    order.OrderDetails.push(orderDetail);

                    order.TotalWeight += orderDetail.Weight;
                    order.TotalQuantity += orderDetail.Quantity;
                    order.TotalPrice += orderDetail.Price;
                    order.DP += orderDetail.DPNominal;
                }

                return order;
            });

    }
};
