const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../config/database');

const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 10);

async function ensureOtpTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS email_otps (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            otp_code VARCHAR(6) NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

function generateOtp() {
    return String(crypto.randomInt(100000, 1000000));
}

function getMailTransporter() {
    const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        throw new Error('SMTP credentials are not fully configured');
    }

    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: String(SMTP_SECURE || 'false').toLowerCase() === 'true',
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        }
    });
}

async function sendOtpMail(name, email, otp) {
    const transporter = getMailTransporter();
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;

    await transporter.sendMail({
        from: fromEmail,
        to: email,
        subject: 'Your ReelVibe OTP Code',
        text: `Hi ${name}, your ReelVibe OTP is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
        html: `<p>Hi ${name},</p><p>Your ReelVibe OTP is:</p><h2 style="letter-spacing: 3px;">${otp}</h2><p>This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>`
    });
}

// Send OTP for user registration
exports.sendRegistrationOtp = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const normalizedEmail = (email || '').trim().toLowerCase();

        // Validate input
        if (!name || !normalizedEmail || !password) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        // Check if user already exists
        const [existingUser] = await db.query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
        if (existingUser.length > 0) {
            return res.status(400).json({ success: false, message: 'User already exists with this email' });
        }

        await ensureOtpTable();

        const otp = generateOtp();
        const hashedPassword = await bcrypt.hash(password, 10);
        const expiryMinutes = Number.isFinite(OTP_EXPIRY_MINUTES) ? OTP_EXPIRY_MINUTES : 10;

        await db.query(
            `INSERT INTO email_otps (email, name, password_hash, otp_code, expires_at)
             VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))
             ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                password_hash = VALUES(password_hash),
                otp_code = VALUES(otp_code),
                expires_at = VALUES(expires_at),
                created_at = CURRENT_TIMESTAMP`,
            [normalizedEmail, name, hashedPassword, otp, expiryMinutes]
        );

        try {
            await sendOtpMail(name, normalizedEmail, otp);
        } catch (mailError) {
            await db.query('DELETE FROM email_otps WHERE email = ?', [normalizedEmail]);
            throw mailError;
        }

        res.json({
            success: true,
            message: `OTP sent to ${normalizedEmail}. It expires in ${expiryMinutes} minutes.`
        });

    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({ success: false, message: 'Unable to send OTP email. Check SMTP configuration.' });
    }
};

// Verify OTP and create user account
exports.verifyRegistrationOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const normalizedEmail = (email || '').trim().toLowerCase();

        if (!normalizedEmail || !otp) {
            return res.status(400).json({ success: false, message: 'Email and OTP are required' });
        }

        await ensureOtpTable();

        const [otpRows] = await db.query('SELECT * FROM email_otps WHERE email = ?', [normalizedEmail]);
        if (otpRows.length === 0) {
            return res.status(400).json({ success: false, message: 'No OTP request found for this email' });
        }

        const otpRecord = otpRows[0];
        if (new Date(otpRecord.expires_at) < new Date()) {
            await db.query('DELETE FROM email_otps WHERE email = ?', [normalizedEmail]);
            return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
        }

        if (String(otpRecord.otp_code) !== String(otp).trim()) {
            return res.status(400).json({ success: false, message: 'Invalid OTP code' });
        }

        const [existingUser] = await db.query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
        if (existingUser.length > 0) {
            await db.query('DELETE FROM email_otps WHERE email = ?', [normalizedEmail]);
            return res.status(400).json({ success: false, message: 'User already exists with this email' });
        }

        // Create user
        const [result] = await db.query(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [otpRecord.name, normalizedEmail, otpRecord.password_hash, 'user']
        );

        // Assign free subscription to new user
        await db.query(
            'INSERT INTO user_subscriptions (user_id, plan_id, start_date, status) VALUES (?, 1, CURDATE(), ?)',
            [result.insertId, 'active']
        );

        await db.query('DELETE FROM email_otps WHERE email = ?', [normalizedEmail]);

        res.status(201).json({ 
            success: true, 
            message: 'User registered successfully',
            userId: result.insertId 
        });

    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ success: false, message: 'Server error during OTP verification' });
    }
};

// Legacy route kept for compatibility
exports.register = async (req, res) => {
    return res.status(400).json({
        success: false,
        message: 'Direct registration is disabled. Request OTP first and verify it to complete signup.'
    });
};

// User Login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        // Find user
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        const user = users[0];

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
};

// Get Current User Profile
exports.getProfile = async (req, res) => {
    try {
        const [users] = await db.query(
            `SELECT u.id, u.name, u.email, u.role, u.created_at,
                    sp.name as subscription_plan, us.status as subscription_status,
                    us.start_date, us.end_date
             FROM users u
             LEFT JOIN user_subscriptions us ON u.id = us.user_id
                AND us.status = 'active'
                AND (us.end_date IS NULL OR us.end_date >= CURDATE())
             LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
             WHERE u.id = ?`,
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, user: users[0] });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Update User Profile
exports.updateProfile = async (req, res) => {
    try {
        const { name, email } = req.body;
        const userId = req.user.id;

        // Check if email is already taken by another user
        if (email) {
            const [existingUser] = await db.query(
                'SELECT * FROM users WHERE email = ? AND id != ?',
                [email, userId]
            );
            if (existingUser.length > 0) {
                return res.status(400).json({ success: false, message: 'Email already in use' });
            }
        }

        // Update user
        await db.query(
            'UPDATE users SET name = ?, email = ? WHERE id = ?',
            [name || req.user.name, email || req.user.email, userId]
        );

        res.json({ success: true, message: 'Profile updated successfully' });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Change Password
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        // Get current password
        const [users] = await db.query('SELECT password FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, users[0].password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

        res.json({ success: true, message: 'Password changed successfully' });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
