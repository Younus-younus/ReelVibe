const db = require('../config/database');

// Get all subscription plans
exports.getPlans = async (req, res) => {
    try {
        const [plans] = await db.query(
            "SELECT * FROM subscription_plans WHERE name IN ('free', 'premium') ORDER BY price ASC"
        );
        const normalizedPlans = plans.map(plan => ({
            ...plan,
            name: plan.name === 'basic' ? 'premium' : plan.name
        }));

        res.json({ success: true, plans: normalizedPlans });
    } catch (error) {
        console.error('Get plans error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get user's current subscription
exports.getUserSubscription = async (req, res) => {
    try {
        await db.query(
            `UPDATE user_subscriptions
             SET status = 'expired'
             WHERE user_id = ? AND status = 'active' AND end_date IS NOT NULL AND end_date < CURDATE()`,
            [req.user.id]
        );

        const [subscription] = await db.query(
            `SELECT us.*, sp.name as plan_name, sp.price, sp.description
             FROM user_subscriptions us
             JOIN subscription_plans sp ON us.plan_id = sp.id
             WHERE us.user_id = ?
               AND us.status = 'active'
               AND (us.end_date IS NULL OR us.end_date >= CURDATE())
                         ORDER BY sp.price DESC, us.created_at DESC LIMIT 1`,
            [req.user.id]
        );

        if (subscription.length === 0) {
            return res.json({ success: true, subscription: null });
        }

        const normalizedSubscription = {
            ...subscription[0],
            plan_name: subscription[0].plan_name === 'basic' ? 'premium' : subscription[0].plan_name
        };

        res.json({ success: true, subscription: normalizedSubscription });

    } catch (error) {
        console.error('Get user subscription error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Subscribe to a plan
exports.subscribe = async (req, res) => {
    try {
        const { plan_id } = req.body;
        const userId = req.user.id;

        // Validate plan
        const [plans] = await db.query('SELECT * FROM subscription_plans WHERE id = ?', [plan_id]);
        if (plans.length === 0) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }

        if (!['free', 'premium'].includes(plans[0].name)) {
            return res.status(400).json({ success: false, message: 'Only free and premium plans are available.' });
        }

        // Cancel existing active subscriptions
        await db.query(
            `UPDATE user_subscriptions SET status = 'cancelled', end_date = CURDATE()
             WHERE user_id = ? AND status = 'active'`,
            [userId]
        );

        // Free plan has no expiry; premium lasts 1 month per subscription
        if (plans[0].name === 'free') {
            await db.query(
                `INSERT INTO user_subscriptions (user_id, plan_id, start_date, end_date, status)
                 VALUES (?, ?, CURDATE(), NULL, 'active')`,
                [userId, plan_id]
            );
        } else {
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 1);

            await db.query(
                `INSERT INTO user_subscriptions (user_id, plan_id, start_date, end_date, status)
                 VALUES (?, ?, CURDATE(), ?, 'active')`,
                [userId, plan_id, endDate.toISOString().split('T')[0]]
            );
        }

        res.json({ 
            success: true, 
            message: `Successfully subscribed to ${plans[0].name} plan` 
        });

    } catch (error) {
        console.error('Subscribe error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Cancel subscription
exports.cancelSubscription = async (req, res) => {
    try {
        const userId = req.user.id;

        await db.query(
            `UPDATE user_subscriptions SET status = 'cancelled', end_date = CURDATE()
             WHERE user_id = ? AND status = 'active'`,
            [userId]
        );

        // Assign free plan
        await db.query(
            `INSERT INTO user_subscriptions (user_id, plan_id, start_date, status)
             VALUES (?, 1, CURDATE(), 'active')`,
            [userId]
        );

        res.json({ success: true, message: 'Subscription cancelled. Switched to free plan.' });

    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get all subscriptions (Admin only)
exports.getAllSubscriptions = async (req, res) => {
    try {
        const [subscriptions] = await db.query(
            `SELECT us.*, u.name as user_name, u.email, sp.name as plan_name
             FROM user_subscriptions us
             JOIN users u ON us.user_id = u.id
             JOIN subscription_plans sp ON us.plan_id = sp.id
             WHERE us.status = 'active'
               AND sp.name = 'premium'
               AND (us.end_date IS NULL OR us.end_date >= CURDATE())
             ORDER BY us.created_at DESC`
        );

        const normalizedSubscriptions = subscriptions.map(subscription => ({
            ...subscription,
            plan_name: subscription.plan_name === 'basic' ? 'premium' : subscription.plan_name
        }));

        res.json({ success: true, subscriptions: normalizedSubscriptions });

    } catch (error) {
        console.error('Get all subscriptions error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Update subscription status (Admin only)
exports.updateSubscriptionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['active', 'expired', 'cancelled'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        await db.query('UPDATE user_subscriptions SET status = ? WHERE id = ?', [status, id]);

        res.json({ success: true, message: 'Subscription status updated' });

    } catch (error) {
        console.error('Update subscription status error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
