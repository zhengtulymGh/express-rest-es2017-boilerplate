const Joi = require('joi');

module.exports = {
  // POST /v1/auth/register
  register: {
    body: {
      phone: Joi.number().required(),
      captcha: Joi.string().required()
      // email: Joi.string().email().required(),
      // password: Joi.string().required().min(6).max(128),
    },
  },

  // POST /v1/auth/login
  login: {
    body: {
      phone: Joi.number().required(),
      captcha: Joi.string().required()
      // email: Joi.string().email().required(),
      // password: Joi.string().required().max(128),
    },
  },

  // POST /v1/auth/facebook
  // POST /v1/auth/google
  oAuth: {
    body: {
      access_token: Joi.string().required(),
    },
  },

  // POST /v1/auth/refresh
  refresh: {
    body: {
      // email: Joi.string().email().required(),
      phone: Joi.number().required(),
      refreshToken: Joi.string().required(),
    },
  },
};
