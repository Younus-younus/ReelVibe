const db = require('../config/database');
const fs = require('fs');
const path = require('path');

// Get all movies with optional filters
exports.getAllMovies = async (req, res) => {
    try {
        const { genre, search } = req.query;
        let query = 'SELECT * FROM movies WHERE 1=1';
        const params = [];

        if (genre) {
            query += ' AND genre = ?';
            params.push(genre);
        }

        if (search) {
            query += ' AND (title LIKE ? OR description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY created_at DESC';

        const [movies] = await db.query(query, params);

        // Filter based on user subscription
        const [userSub] = await db.query(
            `SELECT sp.name as plan FROM user_subscriptions us
             JOIN subscription_plans sp ON us.plan_id = sp.id
             WHERE us.user_id = ? AND us.status = 'active'`,
            [req.user.id]
        );

        const userPlan = userSub[0]?.plan || 'free';
        const accessibleMovies = movies.filter(movie => {
            if (userPlan === 'premium') return true;
            if (userPlan === 'basic') return movie.subscription_required !== 'premium';
            return movie.subscription_required === 'free';
        });

        res.json({ success: true, movies: accessibleMovies });

    } catch (error) {
        console.error('Get movies error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get single movie
exports.getMovie = async (req, res) => {
    try {
        const { id } = req.params;

        const [movies] = await db.query('SELECT * FROM movies WHERE id = ?', [id]);
        if (movies.length === 0) {
            return res.status(404).json({ success: false, message: 'Movie not found' });
        }

        // Check user subscription access
        const [userSub] = await db.query(
            `SELECT sp.name as plan FROM user_subscriptions us
             JOIN subscription_plans sp ON us.plan_id = sp.id
             WHERE us.user_id = ? AND us.status = 'active'`,
            [req.user.id]
        );

        const userPlan = userSub[0]?.plan || 'free';
        const movie = movies[0];

        const hasAccess = 
            userPlan === 'premium' ||
            (userPlan === 'basic' && movie.subscription_required !== 'premium') ||
            movie.subscription_required === 'free';

        if (!hasAccess) {
            return res.status(403).json({ 
                success: false, 
                message: 'Upgrade your subscription to access this content' 
            });
        }

        // Add to watch history
        await db.query(
            'INSERT INTO watch_history (user_id, movie_id) VALUES (?, ?)',
            [req.user.id, id]
        );

        res.json({ success: true, movie });

    } catch (error) {
        console.error('Get movie error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Add movie (Admin only)
exports.addMovie = async (req, res) => {
    try {
        const { title, description, genre, release_year, rating, subscription_required } = req.body;

        const video_url = req.files?.video ? `/uploads/videos/${req.files.video[0].filename}` : null;
        const poster_url = req.files?.poster ? `/uploads/posters/${req.files.poster[0].filename}` : null;

        const [result] = await db.query(
            `INSERT INTO movies (title, description, genre, release_year, rating, video_url, poster_url, subscription_required)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, description, genre, release_year, rating, video_url, poster_url, subscription_required || 'free']
        );

        res.status(201).json({ 
            success: true, 
            message: 'Movie added successfully',
            movieId: result.insertId 
        });

    } catch (error) {
        console.error('Add movie error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Update movie (Admin only)
exports.updateMovie = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, genre, release_year, rating, subscription_required } = req.body;

        const [existing] = await db.query('SELECT * FROM movies WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Movie not found' });
        }

        let video_url = existing[0].video_url;
        let poster_url = existing[0].poster_url;

        if (req.files?.video) {
            video_url = `/uploads/videos/${req.files.video[0].filename}`;
            // Delete old video
            if (existing[0].video_url) {
                const oldPath = path.join(__dirname, '..', existing[0].video_url);
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
            `UPDATE movies SET title = ?, description = ?, genre = ?, release_year = ?, 
             rating = ?, video_url = ?, poster_url = ?, subscription_required = ?
             WHERE id = ?`,
            [title, description, genre, release_year, rating, video_url, poster_url, 
             subscription_required || existing[0].subscription_required, id]
        );

        res.json({ success: true, message: 'Movie updated successfully' });

    } catch (error) {
        console.error('Update movie error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Delete movie (Admin only)
exports.deleteMovie = async (req, res) => {
    try {
        const { id } = req.params;

        const [movie] = await db.query('SELECT * FROM movies WHERE id = ?', [id]);
        if (movie.length === 0) {
            return res.status(404).json({ success: false, message: 'Movie not found' });
        }

        // Delete files
        if (movie[0].video_url) {
            const videoPath = path.join(__dirname, '..', movie[0].video_url);
            if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
        }
        if (movie[0].poster_url) {
            const posterPath = path.join(__dirname, '..', movie[0].poster_url);
            if (fs.existsSync(posterPath)) fs.unlinkSync(posterPath);
        }

        await db.query('DELETE FROM movies WHERE id = ?', [id]);

        res.json({ success: true, message: 'Movie deleted successfully' });

    } catch (error) {
        console.error('Delete movie error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get genres
exports.getGenres = async (req, res) => {
    try {
        const [genres] = await db.query('SELECT DISTINCT genre FROM movies WHERE genre IS NOT NULL');
        res.json({ success: true, genres: genres.map(g => g.genre) });
    } catch (error) {
        console.error('Get genres error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
