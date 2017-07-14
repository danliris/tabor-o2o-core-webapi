'use strict';

module.exports = function(Brand) {
  Brand.validatesLengthOf('Code', { max:4, message: { max: 'Code should be 4- characters' } })
  Brand.validatesUniquenessOf('Code',{message:'Code Is Already Taken'});
}
