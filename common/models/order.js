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

    Order.remoteMethod('updatePaymentStatus', {
        accepts: { arg: 'code', type: 'string' },
        http: { path: '/payment-status', verb: 'post' },
        returns: { arg: 'result', type: 'Order' }
    });

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

    function sum(items, prop) {
        return items.reduce(function (a, b) {
            return a + b[prop];
        }, 0);
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
        var currentDate = new Date();
        // mesti ambil order yang belum lunas
        return Order
            .findOne({
                include: [
                    'OrderDetails'
                    , 'OrderPayments'
                ],
                where: {
                    Code: data.OrderCode
                }
            })
            .then(function (_orderFound) {
                if (_orderFound == null)
                    throw 'Not found / Invalid Status';

                if (_orderFound.IsFullyPaid)
                    throw 'Order has been paid fully';

                if (_orderFound.Status != 'DRAFTED' && _orderFound.Status != 'ARRIVED')
                    throw 'Invalid status';

                return _orderFound.OrderPayments
                    .create({
                        TransactionDate: currentDate,
                        PaymentMethod: 'CASH',
                        PaymentType: data.PaymentType,
                        Amount: data.Amount,
                        PaidAmount: data.PaidAmount,
                        Remark: '-'
                    })
                    .then(res => {
                        return _orderFound;
                    });
            });
    }

    Order.updatePaymentStatus = function (code, cb) {
        var promises = [];

        var currentDate = new Date();
        return Order
            .findOne({
                include: [
                    'OrderDetails'
                    , 'OrderPayments'
                ],
                where: {
                    Code: code
                }
            })
            .then(function (order) {
                if (order == null) {
                    throw 'Not found / Invalid Status';
                }

                if (order.Status != 'DRAFTED' && order.Status != 'ARRIVED')
                    throw 'Invalid Status';

                var totalPaidAmount = order.OrderPayments().reduce(function (a, b) {
                    return b.Amount + a;
                }, 0);

                // lunas?
                var isFullyPaid = totalPaidAmount >= order.TotalPrice + order.TotalShippingFee;

                var nextStatus = '';
                if (order.Status == 'DRAFTED')
                    nextStatus = 'REQUESTED';
                else if (order.Status == 'ARRIVED')
                    nextStatus = 'RECEIVED';

                promises.push(order.updateAttributes({ Status: nextStatus, IsFullyPaid: isFullyPaid }));

                promises.push(order.OrderDetails.updateAll({}, { 'Status': nextStatus }, function (err, info, count) { }));

                for (var i = 0, length = order.OrderDetails().length; i < length; i++) {
                    promises.push(
                        order.OrderDetails()[i].OrderTracks
                            .create({
                                OrderCode: order.OrderDetails()[i].OrderCode,
                                OrderDetailCode: order.OrderDetails()[i].Code,
                                TrackDate: currentDate,
                                Status: nextStatus,
                                Remark: '-'
                            })
                    );
                }

                return Promise.all(promises)
                    .then(response => {
                        return order;
                    });

            });
    }

    Order.voidDraft = function (code, cb) {
        var promises = [];

        var currentDate = new Date();
        return Order
            .findOne({
                include: [
                    'OrderDetails'
                ],
                where: {
                    Code: code
                }
            })
            .then(function (order) {
                if (order == null) {
                    throw 'Not found / Invalid Status';
                }

                // mesti DRAFTED
                if (order.Status != 'DRAFTED')
                    throw 'Invalid Status';

                promises.push(order.updateAttribute('Status', 'VOIDED'));

                promises.push(order.OrderDetails.updateAll({}, { 'Status': 'VOIDED' }, function (err, info, count) { }));

                for (var i = 0, length = order.OrderDetails().length; i < length; i++) {
                    promises.push(
                        order.OrderDetails()[i].OrderTracks
                            .create({
                                OrderCode: order.OrderDetails()[i].OrderCode,
                                OrderDetailCode: order.OrderDetails()[i].Code,
                                TrackDate: currentDate,
                                Status: 'VOIDED',
                                Remark: '-'
                            })
                    );
                }

                Promise.all(promises)
                    .then(response => {
                        return order;
                    });
            });
    }

    Order.completeOrder = function (code, cb) {
        var promises = [],
            status = 'COMPLETED';

        var currentDate = new Date();
        return Order
            .findOne({
                include: [
                    'OrderDetails'
                ],
                where: {
                    Code: code
                }
            })
            .then(function (order) {
                if (order == null) {
                    throw 'Not found / Invalid Status';
                }

                if (order.Status != 'ARRIVED')
                    throw 'Invalid Status';

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

                Promise.all(promises)
                    .then(response => {
                        return order;
                    });
            });
    }

};
