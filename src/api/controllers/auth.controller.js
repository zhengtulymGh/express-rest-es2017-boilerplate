const httpStatus = require('http-status');
const User = require('../models/user.model');
const { Score } = require('../models/score.model');
const RefreshToken = require('../models/refreshToken.model');
const moment = require('moment-timezone');
const { jwtExpirationInterval } = require('../../config/vars');

const svgCaptcha = require('svg-captcha');
const captchaVerify = require('../utils/svgVerify');

/**
* Returns a formated object with tokens
* @private
*/
function generateTokenResponse(user, accessToken) {
  const tokenType = 'Bearer';
  const refreshToken = RefreshToken.generate(user).token;
  const expiresIn = moment().add(jwtExpirationInterval, 'minutes');
  return {
    tokenType, accessToken, refreshToken, expiresIn,
  };
}

/**
 * Returns jwt token if registration was successful
 * @public
 */
exports.register = async (req, res, next) => {
  try {
    if (captchaVerify(req, req.body.captcha)) {
      const user = new User(req.body);
      user.score.push({ sourceKey: 'register' });
      const userSave = await user.save();
      const userTransformed = userSave.transform();
      const token = generateTokenResponse(userSave, userSave.token());

      res.status(httpStatus.CREATED);
      return res.json({ token, user: userTransformed });
    } else {
      return next(User.captchaError());
    }
  } catch (error) {
    // console.log(error)
    return next(User.checkDuplicatePhone(error));
  }
};

/**
 * Returns jwt token if valid phone and captcha is provided
 * @public
 */
exports.login = async (req, res, next) => {
  try {
    if (captchaVerify(req, req.body.captcha)) {
      const { user, accessToken } = await User.findAndGenerateToken(req.body);
      const token = generateTokenResponse(user, accessToken);
      const userTransformed = user.transform();
      return res.json({ token, user: userTransformed });
    } else {
      return next(User.captchaError());
    }
  } catch (error) {
    return next(error);
  }
};

/**
 * login with an existing user or creates a new one if valid accessToken token
 * Returns jwt token
 * @public
 */
exports.oAuth = async (req, res, next) => {
  try {
    const { user } = req;
    const accessToken = user.token();
    const token = generateTokenResponse(user, accessToken);
    const userTransformed = user.transform();
    return res.json({ token, user: userTransformed });
  } catch (error) {
    return next(error);
  }
};

/**
 * Returns a new jwt when given a valid refresh token
 * @public
 */
exports.refresh = async (req, res, next) => {
  try {
    const { phone, refreshToken } = req.body;
    const refreshObject = await RefreshToken.findOneAndRemove({
      userPhone: phone,
      token: refreshToken,
    });
    const { user, accessToken } = await User.findAndGenerateToken({ phone, refreshObject });
    const response = generateTokenResponse(user, accessToken);
    return res.json(response);
  } catch (error) {
    return next(error);
  }
};

/**
 * Returns a svg captcha
 * @public
 */
exports.createCaptcha = (req, res, next) => {
  try {
    const captcha = svgCaptcha.create();
    req.session.captcha = captcha.text;

    res.type('svg');
    res.status(200).send(captcha.data);
  } catch (error) {
    return next(error);
  }
};
