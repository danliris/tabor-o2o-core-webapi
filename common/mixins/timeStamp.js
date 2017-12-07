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
    var accessToken = context.options.accessToken;
    var actor = accessToken && accessToken.userId ? accessToken.userId : "#anonymous";
    // var actor = "#anonymous";

    var data = context.instance || context.data;

    // if (context.instance) {
    if (context.isNewInstance) {
      data.CreatedDate = Date.now();
      data.CreatedBy = actor;
    }
    data.UpdatedDate = Date.now();
    data.UpdatedBy = actor;
    next();
  });

}