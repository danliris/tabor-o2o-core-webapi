
// module.exports = function (obj, options) {
//   // Model is the model class 
//   // options is an object containing the config properties from model definition
//   obj.defineProperty('Active', { type: Boolean, required: true });
//   obj.defineProperty('Deleted', { type: Boolean, required: true })
//   obj.defineProperty('CreatedBy', { type: String, required: true });
//   obj.defineProperty('CreatedDate', { type: Date, required: true });
//   obj.defineProperty('CreateAgent', { type: String, required: true });
//   obj.defineProperty('UpdatedBy', { type: String, required: true });
//   obj.defineProperty('UpdatedDate', { type: Date, required: true });
//   obj.defineProperty('UpdateAgent', { type: String, required: true });
// }




module.exports = function (Model, options) {

  Model.defineProperty('Active', { type: Boolean, default: true });
  Model.defineProperty('Deleted', { type: Boolean, default: false });
  Model.defineProperty('CreatedDate', { type: Date, default: '$now' });
  Model.defineProperty('CreatedBy', { type: String, default: '' });
  Model.defineProperty('CreateAgent', { type: String, default: '' });
  Model.defineProperty('UpdatedDate', { type: Date, default: '$now' });
  Model.defineProperty('UpdatedBy', { type: String, default: '' });
  Model.defineProperty('UpdateAgent', { type: String, default: '' });

  Model.observe('before save', function event(context, next) {
    var data = context.instance || context.data;
    // var accessToken = context.options.accessToken;
    // var actor = accessToken && accessToken.userId ? accessToken.userId : "#anonymous";
    var actor = "#anonymous";
    if (context.instance) {
      data.CreatedDate = Date.now();
      data.CreatedBy = actor;
    }

    data.UpdatedDate = Date.now();
    data.UpdatedBy = actor;
    next();
  });
}