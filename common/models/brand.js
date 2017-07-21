'use strict';

module.exports = function(Brand) {
  Brand.validatesLengthOf('Code', { max:50, message: { max: 'Code should be 50- characters' } })
  Brand.validatesUniquenessOf('Code',{message:'Code Is Already Taken'});
}
