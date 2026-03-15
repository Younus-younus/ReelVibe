const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { verifyToken } = require('../middleware/auth');

// Create a Razorpay order (user must be logged in)
router.post('/create-order', verifyToken, paymentController.createOrder);

// Verify payment signature and activate subscription
router.post('/verify-payment', verifyToken, paymentController.verifyPayment);

module.exports = router;
