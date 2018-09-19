const mongoose = require('mongoose');
const httpStatus = require('http-status');
const { omitBy, isNil } = require('lodash');
const bcrypt = require('bcryptjs');
const moment = require('moment-timezone');
const jwt = require('jwt-simple');
const uuidv4 = require('uuid/v4');
const APIError = require('../utils/APIError');
const { env, jwtSecret, jwtExpirationInterval } = require('../../config/vars');
const { scoreSchema } = require('./score.model');
/**
* User Roles
*/
const roles = ['user', 'admin'];

/**
 * User Schema
 * @private
 */
const userSchema = new mongoose.Schema({
  phone: {
    type: Number,
    match: [/^[1-9][0-9]{10}$/, 'The value of path {PATH} ({VALUE}) is not a valid mobile number.'],
    required: true,
    unique: true,
  },
  avatar: {
    type: String,
    trim: true,
  },
  nickName: {
    type: String,
    maxlength: 128,
    index: true,
    trim: true,
  },
  gender: {
    type: String,
    index: true,
    enum: ['male', 'female'],
    trim: true,
  },
  birthday: {
    type: String,
    index: true,
    trim: true,
  },
  deliveryAddress: [],
  profession: {
    type: String,
    index: true,
  },
  score: [scoreSchema],
  email: {
    type: String,
    match: /^\S+@\S+\.\S+$/,
    // unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    minlength: 6,
    maxlength: 128,
  },
  name: {
    type: String,
    maxlength: 128,
    index: true,
    trim: true,
  },
  services: {
    facebook: String,
    google: String,
  },
  role: {
    type: String,
    enum: roles,
    default: 'user',
  },
}, {
  timestamps: true,
});

/**
 * Add your
 * - pre-save hooks
 * - validations
 * - virtuals
 */
userSchema.pre('save', async function save(next) {
  try {
    console.log('userSchema.pre', this)
    // if (!this.isModified('password')) return next();

    const rounds = env === 'test' ? 1 : 10;

    // const hash = await bcrypt.hash(this.password, rounds);
    // this.password = hash;

    return next();
  } catch (error) {
    return next(error);
  }
});

/**
 * Methods -\
 */
userSchema.method({
  transform() {
    const transformed = {};
    const fields = ['id', 'name', 'nickName', 'phone', 'avatar', 'gender', 'birthday', 'profession', 'deliveryAddress', 'createdAt'];

    fields.forEach((field) => {
      transformed[field] = this[field];
    });

    return transformed;
  },

  getScoreRecords() {
    const transformed = {};
    const fields = ['score'];

    fields.forEach((field) => {
      transformed[field] = this[field];
    });

    return transformed;
  },

  token() {
    const playload = {
      exp: moment().add(jwtExpirationInterval, 'minutes').unix(),
      iat: moment().unix(),
      sub: this._id,
    };
    return jwt.encode(playload, jwtSecret);
  },

  async passwordMatches(password) {
    return bcrypt.compare(password, this.password);
  },
});

/**
 * Statics
 */
userSchema.statics = {

  roles,

  /**
   * Get user
   *
   * @param {ObjectId} id - The objectId of user.
   * @returns {Promise<User, APIError>}
   */
  async get(id) {
    try {
      let user;

      if (mongoose.Types.ObjectId.isValid(id)) {
        user = await this.findById(id).exec();
      }
      if (user) {
        return user;
      }

      throw new APIError({
        message: 'User does not exist',
        status: httpStatus.NOT_FOUND,
      });
    } catch (error) {
      throw error;
    }
  },

  /**
   * Find user by phone and tries to generate a JWT token
   *
   * @param {ObjectId} id - The objectId of user.
   * @returns {Promise<User, APIError>}
   */
  async findAndGenerateToken(options) {
    const { phone, captcha, refreshObject } = options;
    if (!phone) throw new APIError({ message: 'An phone is required to generate a token' });

    const user = await this.findOne({ phone }).exec();
    const err = {
      status: httpStatus.UNAUTHORIZED,
      isPublic: true,
    };
    console.log('captcha', captcha)
    if (captcha) {
      // if (user && await user.passwordMatches(password)) {
      //   return { user, accessToken: user.token() };
      // }
      // err.message = 'Incorrect phone or password';
      if(user) {
        return { user, accessToken: user.token() };
      } else {
        err.message = '用户不存在';
      }
    } else if (refreshObject && refreshObject.userPhone === phone) {
      if (moment(refreshObject.expires).isBefore()) {
        err.message = 'Invalid refresh token.';
      } else {
        return { user, accessToken: user.token() };
      }
    } else {
      err.message = 'Incorrect phone or refreshToken';
    }
    throw new APIError(err);
  },

  /**
   * List users in descending order of 'createdAt' timestamp.
   *
   * @param {number} skip - Number of users to be skipped.
   * @param {number} limit - Limit number of users to be returned.
   * @returns {Promise<User[]>}
   */
  list({
    page = 1, perPage = 30, nickName, phone,
  }) {
    const options = omitBy({ nickName, phone }, isNil);

    return this.find(options)
      .sort({ createdAt: -1 })
      .skip(perPage * (page - 1))
      .limit(perPage)
      .exec();
  },

  captchaError(error) {
    return new APIError({
      message: '验证码错误',
      errors: [{
        field: 'captcha',
        location: 'body',
        messages: ['"captcha" is not correct'],
      }],
      status: httpStatus.BAD_REQUEST,
      isPublic: true,
      stack: '',
    });
  },

  /**
   * Return new validation error
   * if error is a mongoose duplicate key error
   *
   * @param {Error} error
   * @returns {Error|APIError}
   */
  checkDuplicatePhone(error) {
    if (error.name === 'MongoError' && error.code === 11000) {
      return new APIError({
        message: 'Validation Error',
        errors: [{
          field: 'phone',
          location: 'body',
          messages: ['"phone" already exists'],
        }],
        status: httpStatus.CONFLICT,
        isPublic: true,
        stack: error.stack,
      });
    }
    return error;
  },

  async oAuthLogin({
    service, id, phone, nickName, avatar,
  }) {
    const user = await this.findOne({ $or: [{ [`services.${service}`]: id }, { phone }] });
    if (user) {
      user.services[service] = id;
      if (!user.name) user.name = name;
      if (!user.avatar) user.avatar = avatar;
      return user.save();
    }
    const password = uuidv4();
    return this.create({
      services: { [service]: id }, phone, password, name, picture,
    });
  },
};

/**
 * @typedef User
 */
module.exports = mongoose.model('User', userSchema);
