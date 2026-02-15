const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, verifyAdmin } = require('../middleware/auth');

// User routes
router.get('/watch-history', verifyToken, userController.getWatchHistory);

// Admin routes
router.get('/', verifyToken, verifyAdmin, userController.getAllUsers);
router.get('/analytics', verifyToken, verifyAdmin, userController.getAnalytics);
router.get('/:id', verifyToken, verifyAdmin, userController.getUserById);
router.put('/:id/role', verifyToken, verifyAdmin, userController.updateUserRole);
router.delete('/:id', verifyToken, verifyAdmin, userController.deleteUser);

module.exports = router;
