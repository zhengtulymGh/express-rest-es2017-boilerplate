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
* User Levels
*/
const levels = {
  names: [
    { name: 'VIP会员', scoreRequired: 0, key: 1},
    { name: '白银会员', scoreRequired: 10000, key: 2},
    { name: '黄金会员', scoreRequired: 100000, key: 3},
    { name: '钻石会员', scoreRequired: 500000, key: 4}
  ],
  scoreRequired: [0, 10000, 100000, 500000]
};

/**
* User Professions
*/
const genders = [
  {
    name: '男',
    key: 'male'
  }, {
    name: '女',
    key: 'female'
  }
];

/**
* User Professions
*/
const professions = [
  {
    name: '学生',
    key: 1
  }, {
    name: '全职主妇',
    key: 2
  }, {
    name: '白领',
    key: 3
  }, {
    name: '医生',
    key: 4
  }, {
    name: '私营业主',
    key: 5
  }, {
    name: '文艺工作者',
    key: 6
  }, {
    name: '自由职业者',
    key: 7
  }, {
    name: '其他',
    key: 8
  }
];

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
    default: ''
  },
  nickName: {
    type: String,
    maxlength: 128,
    index: true,
    trim: true,
    default: ''
  },
  gender: {
    type: Object,
    index: true,
    enum: genders,
    trim: true,
    default: null
  },
  birthday: {
    type: String,
    index: true,
    trim: true,
    default: ''
  },
  deliveryAddress: [],
  profession: {
    type: Object,
    index: true,
    enum: professions,
    default: null
  },
  score: [scoreSchema],
  level: {
    type: Object,
    enum: levels.names,
    default: levels.names[0],
  },
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
    default: ''
  },
  // services: {
  //   facebook: String,
  //   google: String,
  // },
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
    console.log('this.totalScore', this.totalScore)
    levels.names.forEach(item => {
      if (this.totalScore >= item.scoreRequired) {
        this.level = item
      }
    })

    return next();
  } catch (error) {
    return next(error);
  }
});

userSchema.virtual('totalScore').get(function () {
  let score = 0;
  this.score.forEach(item => {
    score += item.value
  })
  return score;
});

/**
 * Methods -\
 */
userSchema.method({
  transform() {
    const transformed = {};
    const fields = ['id', 'name', 'nickName', 'phone', 'avatar', 'gender', 'birthday', 'profession', 'deliveryAddress', 'score', 'totalScore', 'level', 'createdAt'];

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
  professions,

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
        messages: ['验证码错误'],
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
          messages: ['手机号已存在'],
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
