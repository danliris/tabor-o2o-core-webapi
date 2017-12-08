var LoopBackContext = require('loopback-context');

module.exports = function (Model, options) {

  Model.defineProperty('Active', { type: Boolean, default: true });
  Model.defineProperty('Deleted', { type: Boolean, default: false });
  Model.defineProperty('CreatedDate', { type: Date, default: '$now' });
  Model.defineProperty('CreatedBy', { type: String, default: '' });
  Model.defineProperty('CreateAgent', { type: String, default: '' });
  Model.defineProperty('UpdatedDate', { type: Date, default: '$now' });
  Model.defineProperty('UpdatedBy', { type: String, default: '' });
  Model.defineProperty('UpdateAgent', { type: String, default: '' });

  Model.observe('before save', function (context, next) {
    var ctx = LoopBackContext.getCurrentContext();
    var currentUser = ctx && ctx.get('currentUser');

    var actor = currentUser ? currentUser.username : '#anonymous';

    var data = context.instance || context.data;

    // if (context.instance) {
    if (context.isNewInstance) {
      data.CreatedDate = Date.now();
      data.CreateAgent = '';
      data.CreatedBy = actor;
    }

    data.UpdatedDate = Date.now();
    data.UpdateAgent = '';
    data.UpdatedBy = actor;
    
    next();
  });
}