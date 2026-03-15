const db     = require('../config/database');
const crypto = require('crypto');

// Lazy-load Razorpay so the server doesn't crash if keys are missing
function getRazorpay() {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in environment variables');
    }
    const Razorpay = require('razorpay');
    return new Razorpay({
        key_id:     process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
}

// POST /api/payments/create-order
// Creates a Razorpay order; frontend uses the returned data to open the Razorpay checkout modal
exports.createOrder = async (req, res) => {
    try {
        const { plan_id } = req.body;
        const userId = req.user.id;

        if (!plan_id) {
            return res.status(400).json({ success: false, message: 'Plan ID is required' });
        }

        const [plans] = await db.query('SELECT * FROM subscription_plans WHERE id = ?', [plan_id]);
        if (plans.length === 0) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }

        const plan = plans[0];

        if (plan.name === 'free' || parseFloat(plan.price) === 0) {
            return res.status(400).json({
                success: false,
                message: 'Free plan does not require payment. Use the direct subscribe endpoint.'
            });
        }

        const razorpay = getRazorpay();

        // Razorpay amounts are in the smallest currency unit (paise for INR)
        const amountInPaise = Math.round(parseFloat(plan.price) * 100);

        const order = await razorpay.orders.create({
            amount:   amountInPaise,
            currency: 'INR',
            receipt:  `rv_${userId}_${plan_id}_${Date.now()}`,
            notes: {
                user_id: String(userId),
                plan_id: String(plan_id),
            },
        });

        res.json({
            success:  true,
            order_id: order.id,
            amount:   order.amount,
            currency: order.currency,
            key_id:   process.env.RAZORPAY_KEY_ID,
        });
    } catch (error) {
        console.error('Create Razorpay order error:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to create payment order' });
    }
};

// POST /api/payments/verify-payment
// Verifies Razorpay signature and activates the premium subscription
exports.verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan_id } = req.body;
        const userId = req.user.id;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan_id) {
            return res.status(400).json({ success: false, message: 'Missing payment verification fields' });
        }

        // Verify Razorpay signature: HMAC-SHA256( order_id + "|"+  payment_id, key_secret )
        const generated = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generated !== razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Payment signature verification failed. Contact support.' });
        }

        // Idempotency: skip if this payment_id already activated a subscription
        const [existing] = await db.query(
            "SELECT id FROM user_subscriptions WHERE payment_id = ? AND status = 'active'",
            [razorpay_payment_id]
        );
        if (existing.length > 0) {
            return res.json({ success: true, message: 'Subscription already active', alreadyActivated: true });
        }

        // Validate plan
        const [plans] = await db.query('SELECT * FROM subscription_plans WHERE id = ?', [plan_id]);
        if (plans.length === 0) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }

        // Cancel any existing active subscriptions
        await db.query(
            "UPDATE user_subscriptions SET status = 'cancelled', end_date = CURDATE() WHERE user_id = ? AND status = 'active'",
            [userId]
        );

        // Activate premium for 1 month
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);

        await db.query(
            `INSERT INTO user_subscriptions (user_id, plan_id, start_date, end_date, status, payment_id)
             VALUES (?, ?, CURDATE(), ?, 'active', ?)`,
            [userId, plan_id, endDate.toISOString().split('T')[0], razorpay_payment_id]
        );

        res.json({ success: true, message: 'Premium subscription activated successfully!' });
    } catch (error) {
        console.error('Verify Razorpay payment error:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to verify payment' });
    }
};
