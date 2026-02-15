const db = require('../config/database');
const fs = require('fs');
const path = require('path');

// Get all music with optional filters
exports.getAllMusic = async (req, res) => {
    try {
        const { genre, search } = req.query;
        let query = 'SELECT * FROM music WHERE 1=1';
        const params = [];

        if (genre) {
            query += ' AND genre = ?';
            params.push(genre);
        }

        if (search) {
            query += ' AND (title LIKE ? OR artist LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY created_at DESC';

        const [music] = await db.query(query, params);

        // Filter based on user subscription
        const [userSub] = await db.query(
            `SELECT sp.name as plan FROM user_subscriptions us
             JOIN subscription_plans sp ON us.plan_id = sp.id
             WHERE us.user_id = ? AND us.status = 'active'`,
            [req.user.id]
        );

        const userPlan = userSub[0]?.plan || 'free';
        const accessibleMusic = music.filter(item => {
            if (userPlan === 'premium') return true;
            if (userPlan === 'basic') return item.subscription_required !== 'premium';
            return item.subscription_required === 'free';
        });

        res.json({ success: true, music: accessibleMusic });

    } catch (error) {
        console.error('Get music error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get single music
exports.getMusic = async (req, res) => {
    try {
        const { id } = req.params;

        const [music] = await db.query('SELECT * FROM music WHERE id = ?', [id]);
        if (music.length === 0) {
            return res.status(404).json({ success: false, message: 'Music not found' });
        }

        // Check user subscription access
        const [userSub] = await db.query(
            `SELECT sp.name as plan FROM user_subscriptions us
             JOIN subscription_plans sp ON us.plan_id = sp.id
             WHERE us.user_id = ? AND us.status = 'active'`,
            [req.user.id]
        );

        const userPlan = userSub[0]?.plan || 'free';
        const musicItem = music[0];

        const hasAccess = 
            userPlan === 'premium' ||
            (userPlan === 'basic' && musicItem.subscription_required !== 'premium') ||
            musicItem.subscription_required === 'free';

        if (!hasAccess) {
            return res.status(403).json({ 
                success: false, 
                message: 'Upgrade your subscription to access this content' 
            });
        }

        // Add to watch history
        await db.query(
            'INSERT INTO watch_history (user_id, music_id) VALUES (?, ?)',
            [req.user.id, id]
        );

        res.json({ success: true, music: musicItem });

    } catch (error) {
        console.error('Get music error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Add music (Admin only)
exports.addMusic = async (req, res) => {
    try {
        const { title, artist, genre, subscription_required } = req.body;

        const audio_url = req.files?.audio ? `/uploads/audio/${req.files.audio[0].filename}` : null;
        const poster_url = req.files?.poster ? `/uploads/posters/${req.files.poster[0].filename}` : null;

        const [result] = await db.query(
            `INSERT INTO music (title, artist, genre, audio_url, poster_url, subscription_required)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [title, artist, genre, audio_url, poster_url, subscription_required || 'free']
        );

        res.status(201).json({ 
            success: true, 
            message: 'Music added successfully',
            musicId: result.insertId 
        });

    } catch (error) {
        console.error('Add music error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Update music (Admin only)
exports.updateMusic = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, artist, genre, subscription_required } = req.body;

        const [existing] = await db.query('SELECT * FROM music WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Music not found' });
        }

        let audio_url = existing[0].audio_url;
        let poster_url = existing[0].poster_url;

        if (req.files?.audio) {
            audio_url = `/uploads/audio/${req.files.audio[0].filename}`;
            // Delete old audio
            if (existing[0].audio_url) {
                const oldPath = path.join(__dirname, '..', existing[0].audio_url);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
        }

        if (req.files?.poster) {
            poster_url = `/uploads/posters/${req.files.poster[0].filename}`;
            // Delete old poster
            if (existing[0].poster_url) {
                const oldPath = path.join(__dirname, '..', existing[0].poster_url);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
        }

        await db.query(
            `UPDATE music SET title = ?, artist = ?, genre = ?, audio_url = ?, 
             poster_url = ?, subscription_required = ?
             WHERE id = ?`,
            [title, artist, genre, audio_url, poster_url, 
             subscription_required || existing[0].subscription_required, id]
        );

        res.json({ success: true, message: 'Music updated successfully' });

    } catch (error) {
        console.error('Update music error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Delete music (Admin only)
exports.deleteMusic = async (req, res) => {
    try {
        const { id } = req.params;

        const [music] = await db.query('SELECT * FROM music WHERE id = ?', [id]);
        if (music.length === 0) {
            return res.status(404).json({ success: false, message: 'Music not found' });
        }

        // Delete files
        if (music[0].audio_url) {
            const audioPath = path.join(__dirname, '..', music[0].audio_url);
            if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
        }
        if (music[0].poster_url) {
            const posterPath = path.join(__dirname, '..', music[0].poster_url);
            if (fs.existsSync(posterPath)) fs.unlinkSync(posterPath);
        }

        await db.query('DELETE FROM music WHERE id = ?', [id]);

        res.json({ success: true, message: 'Music deleted successfully' });

    } catch (error) {
        console.error('Delete music error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get genres
exports.getGenres = async (req, res) => {
    try {
        const [genres] = await db.query('SELECT DISTINCT genre FROM music WHERE genre IS NOT NULL');
        res.json({ success: true, genres: genres.map(g => g.genre) });
    } catch (error) {
        console.error('Get genres error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
