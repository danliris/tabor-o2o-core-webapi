'use strict';

module.exports = function(Brand) {
  Brand.validatesLengthOf('Code', { max:5, message: { max: 'Code should be 5- characters' } })
}
