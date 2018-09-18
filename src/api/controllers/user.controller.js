const httpStatus = require('http-status');
const { omit } = require('lodash');
const User = require('../models/user.model');
const { Score, scoreSource } = require('../models/score.model');
const { handler: errorHandler } = require('../middlewares/error');

/**
 * Load user and append to req.
 * @public
 */
exports.load = async (req, res, next, id) => {
  try {
    const user = await User.get(id);
    req.locals = { user };
    return next();
  } catch (error) {
    return errorHandler(error, req, res);
  }
};

/**
 * Get user
 * @public
 */
exports.get = (req, res) => res.json(req.locals.user.transform());

/**
 * Get logged in user info
 * @public
 */
exports.loggedIn = (req, res) => res.json(req.user.transform());

/**
 * Create new user
 * @public
 */
exports.create = async (req, res, next) => {
  try {
    const user = new User(req.body);
    const savedUser = await user.save();
    res.status(httpStatus.CREATED);
    res.json(savedUser.transform());
  } catch (error) {
    next(User.checkDuplicatePhone(error));
  }
};

/**
 * Replace existing user
 * @public
 */
exports.replace = async (req, res, next) => {
  try {
    const { user } = req.locals;
    const newUser = new User(req.body);
    const ommitRole = user.role !== 'admin' ? 'role' : '';
    const newUserObject = omit(newUser.toObject(), '_id', ommitRole);

    await user.update(newUserObject, { override: true, upsert: true });
    const savedUser = await User.findById(user._id);

    res.json(savedUser.transform());
  } catch (error) {
    next(User.checkDuplicatePhone(error));
  }
};

/**
 * Update existing user
 * @public
 */
exports.update = (req, res, next) => {
  const ommitRole = req.locals.user.role !== 'admin' ? 'role' : '';
  const updatedUser = omit(req.body, ommitRole);
  const user = Object.assign(req.locals.user, updatedUser);
  for (let key in updatedUser) {
    if (Object.hasOwnProperty.call(scoreSource, key) && !user.score.filter(item => {
      return item.sourceKey === key
    }).length) {
      user.score = user.score.concat([{ sourceKey: key }])
    }
  }
  user.save()
    .then(savedUser => res.json(savedUser.transform()))
    .catch(e => next(User.checkDuplicatePhone(e)));
};

/**
 * Get user list
 * @public
 */
exports.list = async (req, res, next) => {
  try {
    const users = await User.list(req.query);
    const transformedUsers = users.map(user => user.transform());
    res.json(transformedUsers);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user
 * @public
 */
exports.remove = (req, res, next) => {
  const { user } = req.locals;

  user.remove()
    .then(() => res.status(httpStatus.NO_CONTENT).end())
    .catch(e => next(e));
};


/**
 * Get user score
 * @public
 */
exports.getScoreRecords = (req, res) => res.json(req.locals.user.getScoreRecords());

/**
 * Create new score
 * @public
 */
exports.createScore = (req, res, next) => {
  try {
    const { user } = req.locals;
    const sourceKey = req.body.sourceKey
    // console.log('sourceKey', sourceKey)
    if (user.score.filter(item => {
      return item.sourceKey === sourceKey
    }).length) {
      next(Score.duplicateSourceKey())
      return
    }
    user.score = user.score.concat([{ sourceKey }])
    user.save()
      .then(() => res.json(user.getScoreRecords()))
      .catch(e => next(e));
  } catch (error) {
    next(error)
  }
};

exports.setGender = (req, res, next) => {
  try {
    const { user } = req.locals;
    const sourceKey = 'gender';
    if (!user.score.filter(item => {
      return item.sourceKey === sourceKey
    }).length) {
      user.score = user.score.concat([{ sourceKey }])
    }
    user.gender = req.body.gender;
    user.save()
      .then(() => res.json(user.getScoreRecords()))
      .catch(e => next(e));
  } catch (error) {
    next(error)
  }
};
