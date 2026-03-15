const db = require('../config/database');
const bcrypt = require('bcrypt');

// Get all users (Admin only)
exports.getAllUsers = async (req, res) => {
    try {
        const [users] = await db.query(
            `SELECT u.id, u.name, u.email, u.role, u.created_at,
                    sp.name as subscription_plan, us.status as subscription_status
             FROM users u
             LEFT JOIN user_subscriptions us ON u.id = us.user_id
            AND us.status = 'active'
            AND (us.end_date IS NULL OR us.end_date >= CURDATE())
             LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
             ORDER BY u.created_at DESC`
        );

        res.json({ success: true, users });

    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get user by ID (Admin only)
exports.getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        const [users] = await db.query(
            `SELECT u.id, u.name, u.email, u.role, u.created_at,
                    sp.name as subscription_plan, us.status as subscription_status
             FROM users u
             LEFT JOIN user_subscriptions us ON u.id = us.user_id
                AND us.status = 'active'
                AND (us.end_date IS NULL OR us.end_date >= CURDATE())
             LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
             WHERE u.id = ?`,
            [id]
        );

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, user: users[0] });

    } catch (error) {
        console.error('Get user by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Update user role (Admin only)
exports.updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Invalid role' });
        }

        // Prevent self-demotion
        if (parseInt(id) === req.user.id && role === 'user') {
            return res.status(400).json({ success: false, message: 'Cannot demote yourself' });
        }

        await db.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);

        res.json({ success: true, message: 'User role updated successfully' });

    } catch (error) {
        console.error('Update user role error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Delete user (Admin only)
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent self-deletion
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
        }

        const [user] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
        if (user.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        await db.query('DELETE FROM users WHERE id = ?', [id]);

        res.json({ success: true, message: 'User deleted successfully' });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get watch history
exports.getWatchHistory = async (req, res) => {
    try {
        const userId = req.user.id;

        const [history] = await db.query(
            `SELECT wh.*, 
                    m.title as movie_title, m.poster_url as movie_poster,
                    mu.title as music_title, mu.poster_url as music_poster
             FROM watch_history wh
             LEFT JOIN movies m ON wh.movie_id = m.id
             LEFT JOIN music mu ON wh.music_id = mu.id
             WHERE wh.user_id = ?
             ORDER BY wh.watched_at DESC
             LIMIT 50`,
            [userId]
        );

        res.json({ success: true, history });

    } catch (error) {
        console.error('Get watch history error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get analytics (Admin only)
exports.getAnalytics = async (req, res) => {
    try {
        // Total users
        const [totalUsers] = await db.query('SELECT COUNT(*) as count FROM users');
        
        // Active subscriptions by plan
        const [subscriptionStats] = await db.query(
            `SELECT sp.name as plan, COUNT(*) as count
             FROM user_subscriptions us
             JOIN subscription_plans sp ON us.plan_id = sp.id
                         WHERE us.status = 'active'
                             AND (us.end_date IS NULL OR us.end_date >= CURDATE())
             GROUP BY sp.name`
        );

        // Total movies and music
        const [movieCount] = await db.query('SELECT COUNT(*) as count FROM movies');
        const [musicCount] = await db.query('SELECT COUNT(*) as count FROM music');

        // Recent activity
        const [recentUsers] = await db.query(
            'SELECT COUNT(*) as count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
        );

        res.json({
            success: true,
            analytics: {
                totalUsers: totalUsers[0].count,
                totalMovies: movieCount[0].count,
                totalMusic: musicCount[0].count,
                recentUsers: recentUsers[0].count,
                subscriptionStats: subscriptionStats
            }
        });

    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
