const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { verifyToken, verifyAdmin } = require('../middleware/auth');

// User routes
router.get('/plans', verifyToken, subscriptionController.getPlans);
router.get('/my-subscription', verifyToken, subscriptionController.getUserSubscription);
router.post('/subscribe', verifyToken, subscriptionController.subscribe);
router.put('/cancel', verifyToken, subscriptionController.cancelSubscription);

// Admin routes
router.get('/all', verifyToken, verifyAdmin, subscriptionController.getAllSubscriptions);
router.put('/:id/status', verifyToken, verifyAdmin, subscriptionController.updateSubscriptionStatus);

module.exports = router;
