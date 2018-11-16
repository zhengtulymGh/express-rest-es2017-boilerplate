/**
 * @authors LIyImIn (yiminli@extremevision.com.cn)
 * @date    2018-11-16 16:19:21
 * @version $Id$
 */

const express = require('express');
const validate = require('express-validation');

const {
  getUser
} = require('../../validations/weixin.validation');

const router = express.Router();

router
  .route('/weixin/user')
  .get(validate(getUser))

module.exports = router;