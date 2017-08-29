'use strict';

module.exports = function (Order) {

    Order.remoteMethod('createDraft', {
        accepts: { arg: 'data', type: 'Order' },
        http: { path: '/draft', verb: 'post' },
        returns: { arg: 'result', type: 'Order' }
    });

    Order.remoteMethod('updateDraft', {
        accepts: { arg: 'data', type: 'Order' },
        http: { path: '/draft', verb: 'put' },
        returns: { arg: 'result', type: 'Order' }
    });

    Order.remoteMethod('payment', {
        accepts: { arg: 'data', type: 'OrderPayment' },
        http: { path: '/payment', verb: 'post' },
        returns: { arg: 'result', type: 'Order' }
    });

    Order.remoteMethod('voidDraft', {
        accepts: { arg: 'data', type: 'object' },
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
        order.Date = data.Date;
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
        order.Date = currentDate;
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
        var order = populateOrder(data);

        return (new Order(order))
            .save()
            .then(function (savedOrder, err) {
                for (var i = 0, length = order.OrderDetails.length; i < length; i++) {
                    savedOrder.OrderDetails
                        .create(order.OrderDetails[i])
                        .then(function (savedOrderDetail) {
                            savedOrderDetail.OrderTracks
                                .create(order.OrderDetails[0].OrderTracks[0]);
                        });
                }

                return savedOrder;
            });
    }

    Order.updateDraft = function (data, cb) {
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
            .then(function (orderToBeUpdated) {
                orderToBeUpdated.updateAttributes(
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
                    }, function (err, updatedOrder) {
                        for (var i = 0, length = x.OrderDetails.length; i < length; i++) {
                            var detail = x.OrderDetails[i];
                            
                            updatedOrder
                                .OrderDetails
                                .findById(detail.Code)
                                .then(function (detailToBeUpdated) {
                                    detailToBeUpdated.updateAttributes({
                                        'Quantity': detail.Quantity,
                                        'Price': detail.Price,
                                        'ShippingFee': detail.ShippingFee,
                                        'DPNominal': detail.DPNominal
                                    }, function (err, updatedDetail) {
                                        console.log(updatedDetail);
                                    });
                                });
                        }

                        return updatedOrder;
                    });
            });

    }

    Order.payment = function (data, cb) {
        var currentDate = new Date();
        var status = 'REQUESTED';

        data.PaymentType = 'CASH';
        data.Remark = '-';
        data.TransactionDate = currentDate;

        return Order
            .findOne({
                include: [
                    'OrderDetails'
                    , 'OrderPayments'
                ],
                where: {
                    Code: data.OrderCode
                    , IsFullyPaid: false
                    , Status: 'DRAFTED'
                }
            })
            .then(function (order) {
                // add to order payment
                order.OrderPayments
                    .create(data)
                    .then(function (res) {
                        var total = 0,
                            isFullyPaid = false;

                        for (var i = 0; i < order.OrderPayments().length; i++) {
                            total += order.OrderPayments()[i].Amount;
                        }

                        if (total >= order.TotalPrice + order.TotalShippingFee) {
                            isFullyPaid = true;
                        }

                        order
                            .updateAttributes({
                                Status: status,
                                IsFullyPaid: isFullyPaid
                            }, function (err, res) {

                            });
                    });

                // order.OrderDetails
                //     .updateAll({}, { 'Status': status }, function (err, info, count) {
                //     });

                // update detail + tambahin tracks
                for (var i = 0, length = order.OrderDetails().length; i < length; i++) {
                    var orderDetail = order.OrderDetails()[i];
                    orderDetail.updateAttribute('Status', status);

                    orderDetail.OrderTracks
                        .create({
                            OrderCode: order.Code,
                            OrderDetailCode: orderDetail.Code,
                            TrackDate: currentDate,
                            Status: status,
                            Remark: '-'
                        });
                }
                return order;
            });

        // // update detail + tambahin tracks
        // for (var i = 0, length = order.OrderDetails().length; i < length; i++) {
        //     var orderDetail = order.OrderDetails()[i];
        //     orderDetail.updateAttribute('Status', status);

        //     orderDetail.OrderTracks
        //         .create({
        //             OrderCode: order.Code,
        //             OrderDetailCode: orderDetail.Code,
        //             TrackDate: currentDate,
        //             Status: status,
        //             Remark: '-'
        //         });
        // }
    }

    Order.voidDraft = function (data, cb) {

    }
};
