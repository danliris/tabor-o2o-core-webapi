'use strict';

module.exports = function(Dealer) {
Dealer.validatesLengthOf('Code', { max:5, message: { max: 'Code should be 5- characters' } });
Dealer.validatesUniquenessOf('Code',{message:'must unique'});
};
