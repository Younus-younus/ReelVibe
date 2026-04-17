const db = require('../config/database');
const fs = require('fs');
const path = require('path');
const ALPHA_SPACE_REGEX = /^[A-Za-z ]+$/;

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
        const normalizedMusic = music.map(item => ({
            ...item,
            subscription_required: item.subscription_required === 'basic' ? 'premium' : item.subscription_required
        }));

        // Admins see all music
        if (req.user.role === 'admin') {
            return res.json({ success: true, music: normalizedMusic });
        }

        // Get user subscription status for regular users
        const [userSub] = await db.query(
            `SELECT sp.name as plan, us.status, us.end_date FROM user_subscriptions us
             JOIN subscription_plans sp ON us.plan_id = sp.id
             WHERE us.user_id = ?
               AND us.status = 'active'
               AND (us.end_date IS NULL OR us.end_date >= CURDATE())
             ORDER BY sp.price DESC, us.created_at DESC
             LIMIT 1`,
            [req.user.id]
        );

        const hasActiveMembership = userSub.length > 0;

        const effectivePlan = userSub[0]?.plan || 'free';
        const userPlan = hasActiveMembership && effectivePlan !== 'free' ? 'premium' : 'free';
        
        // Return ALL music but include user's plan for frontend to show locks
        res.json({ success: true, music: normalizedMusic, userPlan });

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

        const musicItem = {
            ...music[0],
            subscription_required: music[0].subscription_required === 'basic' ? 'premium' : music[0].subscription_required
        };

        // Admins have full access without subscription checks
        if (req.user.role === 'admin') {
            return res.json({ success: true, music: musicItem });
        }

        // Check user subscription access for regular users
        const [userSub] = await db.query(
            `SELECT sp.name as plan, us.status, us.end_date FROM user_subscriptions us
             JOIN subscription_plans sp ON us.plan_id = sp.id
             WHERE us.user_id = ?
               AND us.status = 'active'
               AND (us.end_date IS NULL OR us.end_date >= CURDATE())
             ORDER BY sp.price DESC, us.created_at DESC
             LIMIT 1`,
            [req.user.id]
        );

        // Determine user's effective plan (choose highest active non-expired plan)
        const hasActiveMembership = userSub.length > 0;

        const effectivePlan = userSub[0]?.plan || 'free';
        const userPlan = hasActiveMembership && effectivePlan !== 'free' ? 'premium' : 'free';

        // Check if user has access to this content
        const hasAccess =
            userPlan === 'premium' ||
            musicItem.subscription_required === 'free';

        if (!hasAccess) {
            const requiredPlan = musicItem.subscription_required;
            return res.status(403).json({ 
                success: false, 
                message: `This content requires ${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} subscription. Please upgrade to listen.`,
                requiredPlan: requiredPlan
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
        const normalizedTitle = (title || '').trim();
        const normalizedArtist = (artist || '').trim();
        const normalizedGenre = (genre || '').trim();

        if (!normalizedTitle) {
            return res.status(400).json({ success: false, message: 'Music title is required' });
        }

        if (!ALPHA_SPACE_REGEX.test(normalizedTitle)) {
            return res.status(400).json({ success: false, message: 'Music title can contain only alphabetic characters and spaces' });
        }

        if (normalizedArtist && !ALPHA_SPACE_REGEX.test(normalizedArtist)) {
            return res.status(400).json({ success: false, message: 'Music artist can contain only alphabetic characters and spaces' });
        }

        if (normalizedGenre && !ALPHA_SPACE_REGEX.test(normalizedGenre)) {
            return res.status(400).json({ success: false, message: 'Music genre can contain only alphabetic characters and spaces' });
        }

        const audio_url = req.files?.audio ? `/uploads/audio/${req.files.audio[0].filename}` : null;
        const poster_url = req.files?.poster ? `/uploads/posters/${req.files.poster[0].filename}` : null;

        const [result] = await db.query(
            `INSERT INTO music (title, artist, genre, audio_url, poster_url, subscription_required)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [normalizedTitle, normalizedArtist || null, normalizedGenre || null, audio_url, poster_url, subscription_required || 'free']
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

        const [existing] = await db.query('SELECT * FROM music WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Music not found' });
        }

        // Use existing values as fallback if new values are not provided
        const trimmedTitle = req.body.title !== undefined ? String(req.body.title).trim() : undefined;
        if (trimmedTitle !== undefined && !trimmedTitle) {
            return res.status(400).json({ success: false, message: 'Music title cannot be empty' });
        }

        const title = trimmedTitle !== undefined
            ? trimmedTitle
            : existing[0].title;
        const trimmedArtist = req.body.artist !== undefined ? String(req.body.artist).trim() : undefined;
        const trimmedGenre = req.body.genre !== undefined ? String(req.body.genre).trim() : undefined;

        if (title && !ALPHA_SPACE_REGEX.test(title)) {
            return res.status(400).json({ success: false, message: 'Music title can contain only alphabetic characters and spaces' });
        }

        if (trimmedArtist !== undefined && trimmedArtist && !ALPHA_SPACE_REGEX.test(trimmedArtist)) {
            return res.status(400).json({ success: false, message: 'Music artist can contain only alphabetic characters and spaces' });
        }

        if (trimmedGenre !== undefined && trimmedGenre && !ALPHA_SPACE_REGEX.test(trimmedGenre)) {
            return res.status(400).json({ success: false, message: 'Music genre can contain only alphabetic characters and spaces' });
        }

        const artist = trimmedArtist !== undefined 
            ? trimmedArtist 
            : existing[0].artist;
        const genre = trimmedGenre !== undefined && trimmedGenre !== '' 
            ? trimmedGenre 
            : existing[0].genre;
        const subscription_required = req.body.subscription_required !== undefined 
            ? req.body.subscription_required 
            : existing[0].subscription_required;

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
            [title, artist, genre, audio_url, poster_url, subscription_required, id]
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
