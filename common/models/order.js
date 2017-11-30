'use strict';

var fetch = require('node-fetch'),
    JETEXPRESS_API_URL = process.env.JETEXPRESS_API_URL,
    JETEXPRESS_AUTH_URL = process.env.JETEXPRESS_AUTH_URL,
    JETEXPRESS_AUTH_EMAIL = process.env.JETEXPRESS_AUTH_EMAIL,
    JETEXPRESS_AUTH_PASSWORD = process.env.JETEXPRESS_AUTH_PASSWORD,
    JETEXPRESS_AUTH_CLIENT_ID = process.env.JETEXPRESS_AUTH_CLIENT_ID;

module.exports = function (Order) {
    var base = Order.base;

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

    Order.remoteMethod('setOrderDetailArrive', {
        accepts: [
            { arg: 'id', type: 'string', required: true },
            { arg: 'detailId', type: 'string', required: true }
        ],
        http: { path: '/:id/OrderDetails/:detailId/Arrive', verb: 'post' },
        returns: { arg: 'result', type: 'Order' }
    });

    Order.remoteMethod('getLocations', {
        accepts: { arg: 'keyword', type: 'string' },
        http: { path: '/Shipping/Locations', verb: 'get' },
        returns: { arg: 'result', type: 'object' }
    });

    Order.remoteMethod('getPricings', {
        accepts: [
            { arg: 'origin', type: 'string' },
            { arg: 'destination', type: 'string' },
            { arg: 'weight', type: 'number' }
        ],
        http: { path: '/Shipping/Pricings', verb: 'post' },
        returns: { arg: 'result', type: 'object' }
    });

    Order.remoteMethod('getWeightRoundingLimit', {
        http: { path: '/Shipping/WeightRoundingLimit', verb: 'get' },
        returns: { arg: 'result', type: 'number' }
    });

    Order.remoteMethod('notifyDealer', {
        accepts: { arg: 'orderCode', type: 'string' },
        http: { path: '/:orderCode/NotifyDealer', verb: 'post' },
        returns: { arg: 'result', type: 'object' }
    });

    Order.remoteMethod('notifyKiosk', {
        accepts: { arg: 'orderCode', type: 'string' },
        http: { path: '/:orderCode/NotifyKiosk', verb: 'post' },
        returns: { arg: 'result', type: 'object' }
    });

    Order.remoteMethod('updatestatusBy3PL', {
        http: { path: '/3PLCheckStatus', verb: 'get' },
        returns: { arg: 'result', type: 'object' }
    });

    Order.remoteMethod('getWalletBalance', {
        accepts: [
            {
                arg: 'email', type: 'string'
            }],
        http: { path: '/wallets/:email', verb: 'get' },
        returns: { arg: 'result', type: 'object' }
    });

    Order.createDraft = createDraft;
    Order.updateDraft = updateDraft;
    Order.payment = payment;
    Order.voidDraft = voidDraft;
    Order.arriveOrder = arriveOrder;
    Order.setOrderDetailArrive = setOrderDetailArrive;
    Order.completeOrder = completeOrder;
    Order.getLocations = getLocations;
    Order.getPricings = getPricings;
    Order.getWeightRoundingLimit = getWeightRoundingLimit;
    Order.notifyDealer = notifyDealer;
    Order.notifyKiosk = notifyKiosk;
    Order.updatestatusBy3PL = updatestatusBy3PL;
    Order.get3PLToken = get3PLToken;
    Order.getWalletBalance = getWalletBalance;

    function createDraft(data, cb) {
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

    function updateDraft(data, cb) {
        var promises = [];

        return populateData(Order, data, true)
            .then(order => {
                if (!order.SelfPickUp) {
                    return getKiosk(Order, order.KioskCode)
                        .then(kiosk => {
                            order.OriginBranchName = kiosk.BranchName;

                            return updatePricing(order);
                        });
                }

                return order;
            })
            .then(order => {
                Order.upsert(order)
                    .then((_orderSaved, err) => {
                        for (var i = 0, length = order.OrderDetails.length; i < length; i++) {
                            promises.push(Order.app.models.OrderDetail.upsert(order.OrderDetails[i]));
                        }
                        return Promise.all(promises);
                    })
            })

            .then(response => {
                return getOrderWithDetails(Order, data.Code);
            })

            .then(response => {
                return response;
            })
    }

    function getKiosk(Order, kioskCode) {
        return Order.app.models.Kiosk
            .findOne({
                where: {
                    Code: kioskCode
                }
            });
    }

    function getUserByEmail(Order, email) {
        return Order.app.models.User
            .findOne({
                where: {
                    email: email
                }
            });
    }

    function payment(data, cb) {
        // kalo out of stock
        return getOrderWithDetails(Order, data.OrderCode)
            .then(order => {
                if (order == null)
                    return base.errorResult('Not Found / Invalid Status');

                if (order.Status != 'DRAFTED'
                    && order.Status != 'ARRIVED'
                    && order.Status != 'REJECTED')

                    return base.errorResult(`Invalid Status: ${order.Status}`)

                if (order.Status == 'DRAFTED') {
                    if (order.IsFullyPaid)
                        return base.errorResult('Order has been fully paid');

                    return getWalletBalance(order.InChargeEmail)
                        .then(response => {

                            // sementara
                            if (response.rewardCredit + response.topupCredit < order.TotalPrice + order.TotalShippingFee) {
                                return base.errorResult('Saldo wallet tidak mencukupi');
                            }

                            return order.OrderPayments
                                .create({
                                    TransactionDate: new Date(),
                                    PaymentMethod: 'CASH',
                                    PaymentType: data.PaymentType,
                                    Amount: data.Amount,
                                    PaidAmount: data.PaidAmount,
                                    Remark: ''
                                })
                                .then(orderPayment => {
                                    var promises = [];
                                    promises.push(updatePaymentStatus(order));

                                    promises.push(updateProductStock(Order, order));

                                    promises.push(addWalletDebitTransaction(order.InChargeEmail, order.TotalPrice + order.TotalShippingFee));

                                    return Promise.all(promises)
                                        .then(res => {
                                            // return getOrderWithDetails(Order, order.Code)
                                            //     .then(order => {
                                            //         return order;
                                            //     });

                                            notifyDealer(data.OrderCode);

                                            return order;
                                        });
                                });
                        });
                }
                else if (order.Status == 'ARRIVED' || order.Status == 'REJECTED') {
                    return order.OrderPayments
                        .create({
                            TransactionDate: new Date(),
                            PaymentMethod: 'CASH',
                            PaymentType: data.PaymentType,
                            Amount: data.Amount,
                            PaidAmount: data.PaidAmount,
                            Remark: ''
                        })
                        .then(orderPayment => {
                            var promises = [];
                            promises.push(updatePaymentStatus(order));

                            return Promise.all(promises)
                                .then(res => {
                                    // return getOrderWithDetails(Order, order.Code)
                                    //     .then(order => {
                                    //         return order;
                                    //     });

                                    // notifyDealer(data.OrderCode);

                                    return order;
                                });
                        });
                }
            });

    }

    function voidDraft(code, cb) {
        return getOrderWithDetails(Order, code)
            .then(order => {
                if (order == null)
                    return base.errorResult('Not Found');

                if (order.Status != 'DRAFTED')
                    return base.errorResult(`Invalid Status: ${order.Status}`);

                return updateOrderStatus(order, 'VOIDED');
            });
    }

    function arriveOrder(code, cb) {
        return getOrderWithDetails(Order, code)
            .then(order => {
                if (order == null)
                    return base.errorResult('Not Found');

                // mesti udah dikirim sama dealer
                if (order.Status != 'DELIVERED')
                    return base.errorResult(`Invalid Status: ${order.Status}`);


                return updateOrderStatus(order, 'ARRIVED');
            });
    }

    function setOrderDetailArrive(id, detailId, cb) {
        return getOrderWithDetails(Order, id)
            .then(order => {
                if (order == null)
                    return base.errorResult('Not Found');

                if (order.Status != 'DELIVERED' && order.Status != 'PARTIALLY DELIVERED' && order.Status != 'PARTIALLY ARRIVED')
                    return base.errorResult(`Invalid Status: ${order.Status}`);

                // kalo ternyata dia minta dianterin ke rumah
                if (!order.SelfPickUp)
                    return base.errorResult(`This order should be delivered to customer`);

                // update orderdetail
                var orderDetail = order.OrderDetails().find(x => x.Code == detailId);

                if (orderDetail.Status != 'DELIVERED')
                    return base.errorResult(`Invalid Detail Status: ${orderDetail.Status}`);


                return updateOrderDetailStatus(orderDetail, 'ARRIVED');
            })
            .then(orderDetail => {
                return getOrderWithDetails(Order, orderDetail.OrderCode);
            })
            .then(order => {
                var totalDetail = order.OrderDetails().length;
                var totalClosed = 0;

                for (var i = 0; i < totalDetail; i++) {
                    if (order.OrderDetails()[i].Status == 'ARRIVED'
                        || order.OrderDetails()[i].Status == 'REJECTED'
                        || order.OrderDetails()[i].Status == 'VOIDED')
                        totalClosed++;
                }

                var status = (totalClosed < totalDetail) ? 'PARTIALLY ARRIVED' : 'ARRIVED';

                return order.updateAttribute('Status', status);
            })
            .then(response => {
                return response;
            });
    }

    function setOrderDetailCompletedBy3PL(id, detailId) {
        return getOrderWithDetails(Order, id)
            .then(order => {
                if (order == null)
                    return base.errorResult('Not Found');

                if (order.Status != 'DELIVERED' && order.Status != 'PARTIALLY DELIVERED' && order.Status == 'COMPLETED')
                    return base.errorResult(`Invalid Status: ${order.Status}`);

                if (order.SelfPickUp)
                    return base.errorResult(`This order should be delivered to outlet`);

                // update orderdetail
                var orderDetail = order.OrderDetails().find(x => x.Code == detailId);

                if (orderDetail.Status != 'DELIVERED')
                    return base.errorResult(`Invalid Detail Status: ${orderDetail.Status}`);

                return updateOrderDetailStatus(orderDetail, 'COMPLETED');
            })
            .then(orderDetail => {
                return getOrderWithDetails(Order, orderDetail.OrderCode);
            })
            .then(order => {
                var totalDetail = order.OrderDetails().length;
                var totalClosed = 0;

                for (var i = 0; i < totalDetail; i++) {
                    if (order.OrderDetails()[i].Status == 'COMPLETED'
                        || order.OrderDetails()[i].Status == 'REJECTED'
                        || order.OrderDetails()[i].Status == 'REFUNDED'
                        || order.OrderDetails()[i].Status == 'VOIDED')
                        totalClosed++;
                }

                var status = (totalClosed < totalDetail) ? 'PARTIALLY COMPLETED' : 'COMPLETED';

                return order.updateAttribute('Status', status);
            })
            .then(response => {
                return response;
            });
    }

    function completeOrder(code, cb) {
        return getOrderWithDetails(Order, code)
            .then(order => {
                if (order == null)
                    return base.errorResult('Not found');

                if (order.Status != 'ARRIVED' && order.Status != 'REJECTED')
                    return base.errorResult(`Invalid Status: ${order.Status}`);

                var promises = [];
                var currentDate = new Date();

                var refundAmount = 0;
                var refundPayment = order.OrderPayments().find(t => t.PaymentType == 'REFUNDMENT');

                if (refundPayment)
                    refundAmount = refundPayment.PaidAmount;

                // // check any rejected
                // if (order.IsFullyPaid && order.Status == 'REJECTED') {
                //     refundAmount = order.OrderDetails().reduce((a, b) => {
                //         return a + ((b.Status == 'REJECTED' || b.Status == 'REFUNDED') ? b.Price : 0);
                //     }, 0);

                //     if (refundAmount > 0) {
                //         refundAmount += order.TotalShippingFee;

                //         promises.push(order.OrderPayments.create({
                //             TransactionDate: currentDate,
                //             PaymentMethod: 'CASH',
                //             PaymentType: 'REFUNDMENT',
                //             Amount: refundAmount,
                //             PaidAmount: refundAmount,
                //             Remark: 'Barang tidak tersedia'
                //         }));
                //     }
                // }

                if (refundAmount > 0) {
                    promises.push(refundWallet(order.InChargeEmail, refundAmount));
                }

                promises.push(order.updateAttribute('Status', order.Status == 'REJECTED' ? 'REFUNDED' : 'COMPLETED'));

                order.OrderDetails()
                    .filter(t => t.Status != 'VOIDED')
                    .forEach(detail => {
                        let status = detail.Status == 'REJECTED' ? 'REFUNDED' : 'COMPLETED';

                        promises.push(detail.updateAttribute('Status', status));

                        promises.push(detail.OrderTracks.create({
                            OrderCode: detail.OrderCode,
                            OrderDetailCode: detail.Code,
                            TrackDate: currentDate,
                            Status: status,
                            Remark: ''
                        }));
                    });

                return Promise.all(promises)
                    .then(res => {
                        return res[0];
                    });
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
            );
        }

        return Promise.all(promises)
            .then(productDealers => {
                productDealers.forEach(productDealer => {
                    var detail = order.OrderDetails()
                        .find(t => t.ProductCode == productDealer.ProductCode
                            && t.DealerCode == productDealer.DealerCode);

                    productDealer.Quantity -= detail.Quantity;
                    productDealer.save();
                });
            });
    }

    function updatePaymentStatus(order) {
        var totalPaidAmount = order.OrderPayments().reduce(function (a, b) {
            return a + b.PaidAmount;
        }, 0);

        var refundValue = order.OrderDetails().reduce((a, b) => {
            return a + (b.Status == 'REJECTED' ? b.Price : 0);
        }, 0);

        var totalShouldBePaid = order.TotalPrice + order.TotalShippingFee - refundValue;
        // lunas?
        var isFullyPaid = totalPaidAmount >= totalShouldBePaid;

        return order.updateAttribute('IsFullyPaid', isFullyPaid)
            .then(res => {
                var nextStatus = order.Status;
                var shouldUpdateDetail = false; // kalo udah arrived dan mau bayar lagi, ga usah update2 status

                // kalo masih drafted, jadi requested
                if (order.Status == 'DRAFTED') {
                    nextStatus = 'REQUESTED';
                    shouldUpdateDetail = true;
                }
                // kalo arrived, cuekkin aja
                // else if (order.Status == 'ARRIVED')
                //     nextStatus = 'RECEIVED';

                return updateOrderStatus(order, nextStatus, shouldUpdateDetail);
            });
    }

    function getOrderWithDetails(Order, code) {
        return Order.findOne({
            include: ['OrderDetails', 'OrderPayments'],
            where: { Code: code }
        });
    }

    function updateOrderDetailStatus(orderDetail, status) {
        var currentDate = new Date();

        var promises = [];
        promises.push(orderDetail.updateAttribute('Status', status));
        promises.push(orderDetail.OrderTracks.create({
            OrderCode: orderDetail.OrderCode,
            OrderDetailCode: orderDetail.Code,
            TrackDate: currentDate,
            Status: status,
            Remark: ''
        }));

        return Promise.all(promises)
            .then(res => {
                return res[0];
            });
    }

    function updateOrderStatus(order, status, withDetails = true) {
        var currentDate = new Date();
        var promises = [];

        promises.push(order.updateAttribute('Status', status));

        if (withDetails) {
            // kalo VOIDED, REJECTED jangan diupdate lagi. anggap sudah kelar urusannya
            promises.push(order.OrderDetails.updateAll({ Status: { nin: ['VOIDED', 'REJECTED', 'REFUNDED'] } }, { 'Status': status }, function (err, info, count) { }));

            for (var i = 0, length = order.OrderDetails().length; i < length; i++) {

                // kalo voided / rejected jangan diupdate nyong
                if (order.OrderDetails()[i].Status != 'VOIDED'
                    && order.OrderDetails()[i].Status != 'REJECTED'
                    && order.OrderDetails()[i].Status != 'REFUNDED')

                    promises.push(
                        order.OrderDetails()[i].OrderTracks
                            .create({
                                OrderCode: order.OrderDetails()[i].OrderCode,
                                OrderDetailCode: order.OrderDetails()[i].Code,
                                TrackDate: currentDate,
                                Status: status,
                                Remark: ''
                            })
                    );
            }
        }

        return Promise.all(promises)
            .then(res => {
                return res[0];
            });
    }

    function IDGenerator() {
        this.timestamp = +new Date;

        var _getRandomInt = function (min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        this.generate = function (length = 8) {
            var ts = this.timestamp.toString();
            var parts = ts.split("").reverse();
            var id = "";

            for (var i = 0; i < length; ++i) {
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
                    InChargeEmail: data.InChargeEmail,
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
                    TotalWeight: 0, // calculate later
                    ShippingDestination: data.ShippingDestination,
                    ShippingProductCode: data.ShippingProductCode,
                    ShippingDueDay: '', // fetch later
                    TotalShippingFee: 0, // calculate later
                    IsFullyPaid: false,
                    Status: status,
                    OrderDetails: []
                };

                for (var i = 0, length = data.OrderDetails.length; i < length; i++) {
                    var detail = data.OrderDetails[i],
                        product = products.find(x =>
                            x.Code == detail.ProductCode
                            && x.DealerCode == detail.DealerCode);

                    if (detail.Quantity > product.Quantity)
                        return base.errorResult('Insufficient stocks.');

                    var orderDetail = {
                        Code: !isUpdate ? idGenerator.generate(12) : detail.Code,
                        OrderCode: order.Code,
                        ProductCode: detail.ProductCode,
                        DealerCode: detail.DealerCode,
                        Quantity: detail.Quantity,
                        ShippingFee: 0, // calculate later
                        IsRetur: false,
                        Status: detail.Quantity <= 0 ? 'VOIDED' : status,
                        Price: product.Price * detail.Quantity,
                        DPNominal: (product.DP / 100) * product.Price * detail.Quantity,
                        Weight: product.Weight * detail.Quantity,
                        RequestDate: order.RequestDate,
                        OrderTracks: [],
                        Product: product
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

    function updatePricing(data) {
        data.TotalShippingFee = 0;

        if (data.SelfPickUp)
            return data;

        var promises = [];
        // ambil rounding limit
        promises.push(getWeightRoundingLimit());
        // ambil harga / kg
        promises.push(getPricings(data.OriginBranchName, data.ShippingDestination, 1));

        return Promise.all(promises)
            .then(responses => {
                var weightRoundingLimit = responses[0];
                var pricingOptions = responses[1][0].pricingOptions;
                var pricingOption = pricingOptions.find(t => t.productCode == data.ShippingProductCode);

                // Set buat distinct value, Array.from buat convert Set > Array
                var dealerCodes = Array.from(new Set(data.OrderDetails.map(t => t.DealerCode)));

                for (var i = 0, length = dealerCodes.length; i < length; i++) {
                    var weight = data.OrderDetails
                        .filter(t => t.DealerCode == dealerCodes[i]) // filter by dealer code
                        .map(t => t.Quantity * t.Product.Weight) // bikin array baru yang isinya berat * quantity << weight ini udah calculated mesti retrieve dari db lagi
                        .reduce((a, b) => { return a + b }); // total berat

                    data.OrderDetails.filter(t => t.DealerCode == dealerCodes[i])
                        .forEach(detail => {
                            detail.ShippingFee = pricingOption.calculationResult;
                        });

                    // pembulatan
                    if (weight == 0)
                        weight = 0;
                    else if (weight < 1)
                        weight = 1;
                    else if (weight - Math.floor(weight) > weightRoundingLimit)
                        weight = Math.ceil(weight);
                    else
                        weight = Math.floor(weight);

                    data.TotalShippingFee += weight * pricingOption.calculationResult;
                }

                return data;
            });
    }

    function notifyKiosk(orderCode) {

        return Order.findOne({ where: { Code: orderCode } })
            .then(order => {
                if (!order)
                    return base.errorResult('Not Found');

                var message = `${order.Status} - ${order.Code}`;

                if (order.Status == 'REJECTED')
                    message = `Pesanan dengan kode: ${order.Code} dibatalkan oleh dealer.`;
                if (order.Status == 'DELIVERED')
                    message = `Pesanan dengan kode: ${order.Code} telah dikirim oleh dealer.`;

                var payload = {
                    "orderCode": order.Code,
                    "status": order.Status
                };

                // ga jadi pake web push 20171025
                // var filters = [
                //     { "field": "tag", "key": "kioskCode", "relation": "=", "value": order.KioskCode },
                //     { "field": "tag", "key": "role", "relation": "=", "value": "staff" },
                //     { "field": "tag", "key": "email", "relation": "=", "value": order.InChargeEmail }
                // ];

                // base.sendNotification(base.grindData(message, payload, filters));

                // get userid by email
                return getUserByEmail(Order, order.InChargeEmail)
                    .then(user => {
                        return Order.app.models.Notification.create({ UserId: user.id, NotifiedDate: new Date(), Message: message, Data: JSON.stringify(payload), IsRead: 0 });
                    })
            })
            .then(notification => {
                return notification;
            })
            .catch(err => { return base.errorResult(err); })
            .finally(() => {
                return true;
            });
    }

    function notifyDealer(orderCode) {

        return getOrderWithDetails(Order, orderCode)
            .then(order => {
                if (!order)
                    return base.errorResult('Not Found');

                var dealerCodes = Array.from(new Set(order.OrderDetails().map(t => t.DealerCode)));

                dealerCodes.forEach(dealerCode => {
                    var message = `${order.Status} - ${order.Code}`;
                    var payload = {
                        "orderCode": order.Code,
                        "status": order.Status,
                        "kioskCode": order.KioskCode
                    };

                    var filters = [
                        { "field": "tag", "key": "dealerCode", "relation": "=", "value": dealerCode }
                    ];

                    base.sendNotification(base.grindData(message, payload, filters));
                });
            })
            .catch(err => { return base.errorResult(err); })
            .finally(() => {
                return true;
            });
    }

    // buat update status order secara berkala
    function updatestatusBy3PL() {
        // get order yang delivered & punya pickup information
        return Order.find({
            include: {
                OrderDetails: 'OrderDetailDeliveries'
            },
            where: {
                or: [
                    { Status: 'PARTIALLY DELIVERED' },
                    { Status: 'DELIVERED' },
                    { Status: 'PARTIALLY COMPLETED' }
                ],
                SelfPickUp: false
            }
        }).then(orders => {
            var bookingCodes = [],
                bookingCode = '',
                promises = [];

            orders.forEach(order => {
                order.OrderDetails()
                    .filter(t => t.Status == 'DELIVERED')
                    .forEach(orderDetail => {
                        bookingCode = orderDetail
                            .OrderDetailDeliveries()
                            .map(t => t.PickUpItemCode);

                        if (bookingCode.length > 0)
                            promises.push(checkStatusFrom3PL(bookingCode)
                                .then(waybill => {
                                    if (waybill.status == 'DELIVERED')
                                        return setOrderDetailCompletedBy3PL(orderDetail.OrderCode, orderDetail.Code);
                                    else
                                        return Promise.resolve(order);
                                }));

                    });
            });


            return Promise.all(promises)
                .then(responses => {
                    return responses;
                });

        });
    }

    //region JET EXPRESS
    function getLocations(keyword) {
        return fetch(`${JETEXPRESS_API_URL}/v1/pricings/locations?keyword=${keyword}`)
            .then(res => {
                return res.json();
            })
            .catch(err => {
                return base.errorResult(err);
            });
    }

    function getPricings(origin, destination, weight = 1) {
        return fetch(`${JETEXPRESS_API_URL}/v1/pricings`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `origin_value=${origin.toUpperCase()}&destination_value=${destination.toUpperCase()}&weight=${weight}` })
            .then(res => {
                return res.json();
            })
            .catch(err => {
                return base.errorResult(err);
            });
    }

    function getWeightRoundingLimit() {
        return fetch(`${JETEXPRESS_API_URL}/v1/configurations`)
            .then(res => {
                return res.json();
            })
            .then(json => {
                return json.weightRoundingLimit;
            })
            .catch(err => {
                return base.errorResult(err);
            });
    }

    function checkStatusFrom3PL(bookingCode) {
        return fetch(`${JETEXPRESS_API_URL}/v1/tracks/waybills-by-booking-number/${bookingCode}`)
            .then(res => { return res.json(); })
            .catch(err => {
                return base.errorResult(err);
            });
    }
    //endregion

    //region Wallet
    function get3PLToken() {
        // cek kalo ada dan belum expired
        if (global.o2oJetAuthentication) {
            if ((new Date()) < global.o2oJetAuthentication.expiredAt)
                return Promise.resolve(global.o2oJetAuthentication);
        }

        var options = {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: `username=${JETEXPRESS_AUTH_EMAIL}&password=${JETEXPRESS_AUTH_PASSWORD}&client_id=${JETEXPRESS_AUTH_CLIENT_ID}&grant_type=password`
        };

        return fetch(`${JETEXPRESS_AUTH_URL}/oauth/token`, options)
            .then(res => {
                return res.json();
            })
            .then(res => {
                global.o2oJetAuthentication = res;
                global.o2oJetAuthentication.expiredAt = (new Date()).getTime() + res.expires_in;
                return res;
            })
            .catch(err => {
                return base.errorResult(err);
            });
    }

    function getWalletBalance(email) {
        // get token
        return get3PLToken()
            .then(res => {
                return fetch(`${JETEXPRESS_API_URL}/v1/wallets?email=${email}`, {
                    method: 'GET',
                    headers: { 'Authorization': `${res.token_type} ${res.access_token}` }
                });
            })
            .then(walletResponse => {
                return walletResponse.json();
            })
            .then(wallet => {
                return wallet;
            });
    }

    function addWalletDebitTransaction(email, nominal) {
        return get3PLToken()
            .then(res => {
                return fetch(`${JETEXPRESS_API_URL}/v1/wallets/transactions/debit?email=${email}&nominal=${nominal}`, {
                    method: 'POST',
                    headers: { 'Authorization': `${res.token_type} ${res.access_token}` }
                });
            });
    }

    // function addTopUpCredit(email, nominal) {
    //     return get3PLToken()
    //         .then(res => {
    //             return fetch(`${JETEXPRESS_API_URL}/v1/wallets/topups/credit?email=${email}&nominal=${nominal}`, {
    //                 method: 'POST',
    //                 headers: { 'Authorization': `${res.token_type} ${res.access_token}` }
    //             });
    //         });
    // }

    function refundWallet(email, nominal) {
        return get3PLToken()
            .then(res => {
                return fetch(`${JETEXPRESS_API_URL}/v1/wallets/transactions/refund?email=${email}&nominal=${nominal}`, {
                    method: 'POST',
                    headers: { 'Authorization': `${res.token_type} ${res.access_token}` }
                });
            });
    }
    //endregion

};
