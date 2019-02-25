const express = require('express');
const userRoutes = require('./user.route');
const authRoutes = require('./auth.route');

const router = express.Router();

const fs = require('fs');

/**
 * GET v1/status
 */
router.get('/status', (req, res) => res.send('OK'));

/**
 * GET v1/page
 */
router.use('/views', express.static('views'));

/**
 * GET v1/docs
 */
router.use('/docs', express.static('docs'));

router.use('/api/v1/users', userRoutes);
router.use('/api/v1/auth', authRoutes);

module.exports = router;
