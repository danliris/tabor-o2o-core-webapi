'use strict';

module.exports = function (Order) {

    Order.remoteMethod('createDraft', {
        accepts: { arg: 'data', type: 'Order' },
        http: { path: '/draft', verb: 'post' },
        returns: { arg: 'result', type: 'Order' }
    });

    Order.remoteMethod('updateDraft', {
        accepts: [
            { arg: 'data', type: 'Order', 'required': true },
            { arg: 'options', type: 'object', 'http': 'optionsFromRequest' }
        ],
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
                    Code: detail.ProductCode,
                    DealerCode: detail.DealerCode
                }
            });
    }

    function populateOrderForEdit(data) {
        var order = {};
        order.Code = data.Code;
        order.KioskCode = data.KioskCode;
        order.IdCard = data.IdCard;

        order.Name = data.Name;
        order.Email = data.Email;
        order.RequestDate = data.RequestDate;
        order.Latitude = data.Latitude;
        order.Longitude = data.Longitude;
        order.SelfPickUp = data.SelfPickUp;
        order.Destination = data.Destination;
        order.Phone = data.Phone;
        order.PIN = data.PIN;
        order.DP = 0; // itung
        order.TotalQuantity = sum(data.OrderDetails(), 'Quantity');
        order.TotalShippingFee = 0; // itung
        order.TotalPrice = 0; // itung
        order.IsFullyPaid = false;
        order.Status = data.Status;

        order.OrderDetails = [];

        for (var i = 0; i < data.OrderDetails().length; i++) {
            var detail = data.OrderDetails()[i];

            var orderDetail = {};
            orderDetail.Code = detail.Code;
            orderDetail.OrderCode = detail.OrderCode;
            orderDetail.ProductCode = detail.ProductCode;
            orderDetail.DealerCode = detail.DealerCode;
            orderDetail.Quantity = detail.Quantity;
            orderDetail.ShippingFee = 0;
            orderDetail.IsRetur = false;
            orderDetail.Status = detail.Status;
            orderDetail.Price = detail.Price;
            orderDetail.DPNominal = detail.DPNominal;
            orderDetail.RequestDate = detail.RequestDate;

            order.OrderDetails.push(orderDetail);

            order.TotalShippingFee += orderDetail.ShippingFee;
            order.DP += orderDetail.DPNominal * orderDetail.Quantity;
            order.TotalPrice += orderDetail.Price * orderDetail.Quantity;
        }

        return order;
    }

    function populateOrder(data) {
        var status = 'DRAFTED';
        var currentDate = new Date();
        var idGenerator = new IDGenerator();
        var orderCode = idGenerator.generate();

        var order = {};
        order.Code = orderCode;
        order.KioskCode = data.KioskCode;
        order.IdCard = data.IdCard;
        order.Name = data.Name;
        order.Email = data.Email;
        order.RequestDate = currentDate;
        order.Latitude = data.Latitude;
        order.Longitude = data.Longitude;
        order.SelfPickUp = data.SelfPickUp;
        order.Destination = data.Destination;
        order.Phone = data.Phone;
        order.PIN = generatePIN();
        order.DP = 0; // itung
        order.TotalQuantity = sum(data.OrderDetails(), 'Quantity');
        order.TotalShippingFee = 0; // itung
        order.TotalPrice = 0; // itung
        order.IsFullyPaid = false;
        order.Status = status;
        order.OrderDetails = [];


        for (var i = 0; i < data.OrderDetails().length; i++) {
            var detail = data.OrderDetails()[i];

            var orderDetail = {};
            orderDetail.Code = idGenerator.generate();
            orderDetail.OrderCode = orderCode;
            orderDetail.ProductCode = detail.ProductCode;
            orderDetail.DealerCode = detail.DealerCode;
            orderDetail.Quantity = detail.Quantity;
            orderDetail.ShippingFee = 0;
            orderDetail.IsRetur = false;
            orderDetail.Status = status;
            orderDetail.Price = detail.Price;
            orderDetail.DPNominal = detail.DPNominal;
            orderDetail.RequestDate = currentDate;

            orderDetail.OrderTracks = [];
            orderDetail.OrderTracks.push({
                OrderCode: orderDetail.OrderCode,
                OrderDetailCode: orderDetail.Code,
                TrackDate: currentDate,
                Status: status,
                Remark: ''
            });

            order.OrderDetails.push(orderDetail);

            order.TotalShippingFee += orderDetail.ShippingFee;
            order.DP += orderDetail.DPNominal * orderDetail.Quantity;
            order.TotalPrice += orderDetail.Price * orderDetail.Quantity;
        }

        return order;
    }

    Order.createDraft = function (data, cb) {
        var promises = [];
        var order = populateOrder(data);

        return (new Order(order))
            .save()
            .then(function (_orderSaved, err) {
                for (var i = 0, length = order.OrderDetails.length; i < length; i++) {
                    promises.push(
                        _orderSaved.OrderDetails
                            .create(order.OrderDetails[i])
                            .then(function (_orderSavedDetail) {
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
    }

    Order.updateDraft = function (data, options, cb) {
        var x = populateOrderForEdit(data);

        return Order
            .findOne({
                include: [
                    'OrderDetails'
                    , 'OrderPayments'
                ],
                where: {
                    Code: x.Code
                    , Status: 'DRAFTED'
                }
            })
            .then(function (_orderFound) {
                var promises = [];

                return _orderFound.updateAttributes(
                    {
                        'IdCard': x.IdCard
                        , 'Name': x.Name
                        , 'Email': x.Email
                        , 'SelfPickUp': x.SelfPickUp
                        , 'Destination': x.Destination
                        , 'Phone': x.Phone
                        , 'DP': x.DP
                        , 'TotalQuantity': x.TotalQuantity
                        , 'TotalShippingFee': x.TotalShippingFee
                        , 'TotalPrice': x.TotalPrice
                        , 'IsFullyPaid': x.IsFullyPaid
                    }, function (err, _orderUpdated) {
                        for (var i = 0, length = x.OrderDetails.length; i < length; i++) {
                            var detail = x.OrderDetails[i];

                            promises.push(
                                _orderUpdated.OrderDetails
                                    .updateById(detail.Code, {
                                        'Quantity': detail.Quantity,
                                        'Price': detail.Price,
                                        'ShippingFee': detail.ShippingFee,
                                        'DPNominal': detail.DPNominal
                                    })
                            );
                        }

                        return Promise.all(promises)
                            .then(response => {
                                return _orderFound;
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

                if (order.Status != 'ARRIVED')
                    throw 'Invalid Status';

                promises.push(order.updateAttribute('Status', 'RECEIVED'));

                promises.push(order.OrderDetails.updateAll({}, { 'Status': 'RECEIVED' }, function (err, info, count) { }));

                for (var i = 0, length = order.OrderDetails().length; i < length; i++) {
                    promises.push(
                        order.OrderDetails()[i].OrderTracks
                            .create({
                                OrderCode: order.OrderDetails()[i].OrderCode,
                                OrderDetailCode: order.OrderDetails()[i].Code,
                                TrackDate: currentDate,
                                Status: 'RECEIVED',
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
