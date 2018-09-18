const mongoose = require('mongoose');
const httpStatus = require('http-status');
const { omitBy, isNil } = require('lodash');
// const bcrypt = require('bcryptjs');
// const moment = require('moment-timezone');
// const jwt = require('jwt-simple');
// const uuidv4 = require('uuid/v4');
const APIError = require('../utils/APIError');
// const { env, jwtSecret, jwtExpirationInterval } = require('../../config/vars');

/**
* Score Sources
*/
const source = {
  register: {
    name: '注册',
    score: 500
  },
  share: {
    name: '分享',
    score: 1000
  },
  gender: {
    name: '设置性别',
    score: 100
  },
  birthday: {
    name: '设置生日',
    score: 100
  },
  profession: {
    name: '设置工作信息',
    score: 100
  },
  deliveryAddress: {
    name: '设置收货地址',
    score: 100
  },
};

/**
 * Score Schema
 * @private
 */
const scoreSchema = new mongoose.Schema({
  value: {
    type: Number,
    required: false,
    trim: true
  },
  sourceName: {
    type: String,
    required: false,
    trim: true
  },
  sourceKey: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
});

/**
 * Add your
 * - pre-save hooks
 * - validations
 * - virtuals
 */
scoreSchema.pre('save', async function save(next) {
  try {
    const item = source[this.sourceKey]
    this.value = this.value || (item && item.score)
    this.sourceName = this.sourceName || (item && item.name)
    return next();
  } catch (error) {
    return next(error);
  }
});

/**
 * Methods
 */
scoreSchema.method({
  transform() {
    const transformed = {};
    const fields = ['id', 'value', 'sourceName', 'createdAt'];
    
    fields.forEach((field) => {
      transformed[field] = this[field];
    });

    return transformed;
  },
});

/**
 * Statics
 */
scoreSchema.statics = {

  // roles,

  /**
   * Get score
   *
   * @param {ObjectId} id - The objectId of score.
   * @returns {Promise<Score, APIError>}
   */
  async get(id) {
    try {
      let score;

      if (mongoose.Types.ObjectId.isValid(id)) {
        score = await this.findById(id).exec();
      }
      if (score) {
        return score;
      }

      throw new APIError({
        message: 'Score does not exist',
        status: httpStatus.NOT_FOUND,
      });
    } catch (error) {
      throw error;
    }
  },

  /**
   * List scores in descending order of 'createdAt' timestamp.
   *
   * @param {number} skip - Number of scores to be skipped.
   * @param {number} limit - Limit number of scores to be returned.
   * @returns {Promise<Score[]>}
   */
  list({
    page = 1, perPage = 30, value, sourceName, createdAt,
  }) {
    const options = omitBy({ value, sourceName }, isNil);

    return this.find(options)
      .sort({ createdAt: -1 })
      .skip(perPage * (page - 1))
      .limit(perPage)
      .exec();
  },

  /**
   * Return new validation error
   *
   * @param {Error} error
   * @returns {Error|APIError}
   */
  duplicateSourceKey(error) {
    return new APIError({
      message: 'Validation Error',
      errors: [{
        field: 'sourceKey',
        location: 'body',
        messages: ['sourceKey already exists'],
      }],
      status: httpStatus.CONFLICT,
      isPublic: true,
      stack: error && error.stack,
    });
  },
};

/**
 * @typedef Score
 */
module.exports = {
  'scoreSchema': scoreSchema,
  'Score': mongoose.model('Score', scoreSchema),
  scoreSource: source
}
