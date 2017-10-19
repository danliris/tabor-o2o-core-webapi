'use strict';

var fetch = require('node-fetch'),
    JETEXPRESS_API_URL = process.env.JETEXPRESS_API_URL;

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

    function payment(data, cb) {
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

                        // kalo lagi mau requested, update stok. pas pelunasan ga perlu update stock
                        if (order.Status == 'DRAFTED')
                            promises.push(updateProductStock(Order, order));

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
            })
    }

    function voidDraft(code, cb) {
        return getOrderWithDetails(Order, code)
            .then(order => {
                if (order == null)
                    throw 'Not found';

                if (order.Status != 'DRAFTED')
                    throw `Invalid Status: ${order.Status}`;

                return updateOrderStatus(order, 'VOIDED');
            });
    }

    function arriveOrder(code, cb) {
        return getOrderWithDetails(Order, code)
            .then(order => {
                if (order == null)
                    throw 'Not found';

                // mesti udah dikirim sama dealer
                if (order.Status != 'DELIVERED')
                    throw `Invalid Status: ${order.Status}`;

                return updateOrderStatus(order, 'ARRIVED');
            });
    }

    function setOrderDetailArrive(id, detailId, cb) {
        return getOrderWithDetails(Order, id)
            .then(order => {
                if (order == null)
                    throw 'Not found';

                if (order.Status != 'DELIVERED' && order.Status != 'PARTIALLY DELIVERED' && order.Status != 'PARTIALLY ARRIVED')
                    throw `Invalid Status: ${order.Status}`;

                // update orderdetail
                var orderDetail = order.OrderDetails().find(x => x.Code == detailId);

                if (orderDetail.Status != 'DELIVERED')
                    throw `Invalid Detail Status: ${orderDetail.Status}`;

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

    function completeOrder(code, cb) {
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
            return b.PaidAmount + a;
        }, 0);

        // lunas?
        var isFullyPaid = totalPaidAmount >= order.TotalPrice + order.TotalShippingFee;

        return order.updateAttribute('IsFullyPaid', isFullyPaid)
            .then(res => {
                var nextStatus = order.Status;

                // kalo masih drafted, jadi requested
                if (order.Status == 'DRAFTED')
                    nextStatus = 'REQUESTED';

                // kalo arrived, cuekkin aja
                // else if (order.Status == 'ARRIVED')
                //     nextStatus = 'RECEIVED';

                return updateOrderStatus(order, nextStatus, false);
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
            Remark: '-'
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
            promises.push(order.OrderDetails.updateAll({ Status: { nin: ['VOIDED', 'REJECTED'] } }, { 'Status': status }, function (err, info, count) { }));

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
                    TotalWeight: 0, // calcluate later
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
                        throw 'Insufficient stocks.';

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
                        .map(t => t.Quantity * t.Weight) // bikin array baru yang isinya berat * quantity
                        .reduce((a, b) => { return a + b }); // total berat

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

    function getLocations(keyword) {
        return fetch(`${JETEXPRESS_API_URL}/v1/pricings/locations?keyword=${keyword}`)
            .then(res => {
                return res.json();
            })
            .catch(err => {
                throw err;
            });
    }

    function getPricings(origin, destination, weight = 1) {
        return fetch(`${JETEXPRESS_API_URL}/v1/pricings`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `origin_value=${origin.toUpperCase()}&destination_value=${destination.toUpperCase()}&weight=${weight}` })
            .then(res => {
                return res.json();
            })
            .catch(err => {
                throw err;
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
                throw err;
            });
    }

    function notifyKiosk(orderCode) {
        var base = Order.base;
        return Order.findOne({ where: { Code: orderCode } })
            .then(order => {
                if (!order)
                    throw 'Not Found';

                var message = `${order.Status} - ${order.Code}`;
                var payload = {
                    "orderCode": order.Code,
                    "status": order.Status
                };
                var filters = [
                    { "field": "tag", "key": "kioskCode", "relation": "=", "value": order.KioskCode },
                    { "field": "tag", "key": "role", "relation": "=", "value": "staff" },
                    { "field": "tag", "key": "email", "relation": "=", "value": order.InChargeEmail }
                ];

                base.sendNotification(base.grindData(message, payload, filters));

                // save to notifications
            })
            .catch(err => { throw err; })
            .finally(() => {
                return true;
            });
    }

    function notifyDealer(orderCode) {
        var base = Order.base;
        return getOrderWithDetails(Order, orderCode)
            .then(order => {
                if (!order)
                    throw 'Not Found';

                var dealerCodes = order.OrderDetails().map(t => t.DealerCode);

                dealerCodes.forEach(dealerCode => {
                    var message = `${order.Status} - ${order.Code}`;
                    var payload = {
                        "orderCode": order.Code,
                        "status": order.Status
                    };
                    var filters = [
                        { "field": "tag", "key": "dealerCode", "relation": "=", "value": dealerCode }
                    ];
                    base.sendNotification(base.grindData(message, payload, filters));

                    // save to notifications
                });
            })
            .catch(err => { throw err; })
            .finally(() => {
                return true;
            });
    }
};
