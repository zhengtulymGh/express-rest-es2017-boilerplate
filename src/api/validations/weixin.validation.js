const Joi = require('joi');

module.exports = {
  getUser: {
    query: {
      appid: Joi.string().required(),
      secret: Joi.string().required(),
      code: Joi.string().required(),
      grant_type: Joi.string().required()
    }
  }
}