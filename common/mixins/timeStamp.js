
module.exports = function(brand, options) {
  // Model is the model class 
  // options is an object containing the config properties from model definition
  brand.defineProperty('Active', {type: Boolean,required:true});
  brand.defineProperty('Deleted', {type: Boolean,required:true})
  brand.defineProperty('CreatedBy', {type: String, required:true});
  brand.defineProperty('CreatedDate', {type: Date, required:true});
  brand.defineProperty('CreateAgent', {type: String,  required:true});
  brand.defineProperty('UpdatedBy', {type: String, required:true});
  brand.defineProperty('UpdatedDate', {type: Date, required:true});
  brand.defineProperty('UpdateAgent', {type: String,  required:true});
}

