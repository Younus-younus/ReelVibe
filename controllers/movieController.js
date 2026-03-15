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
        const normalizedMovies = movies.map(movie => ({
            ...movie,
            subscription_required: movie.subscription_required === 'basic' ? 'premium' : movie.subscription_required
        }));

        console.log('getAllMovies - Total movies in DB:', normalizedMovies.length);

        // Admins see all movies
        if (req.user.role === 'admin') {
            return res.json({ success: true, movies: normalizedMovies });
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

        const effectivePlan = userSub[0]?.plan === 'basic' ? 'premium' : (userSub[0]?.plan || 'free');
        const userPlan = hasActiveMembership ? effectivePlan : 'free';
        
        console.log('getAllMovies - User ID:', req.user.id);
        console.log('getAllMovies - User subscription:', userSub[0]);
        console.log('getAllMovies - Effective user plan:', userPlan);
        console.log('getAllMovies - Returning movies count:', normalizedMovies.length);
        
        // Return ALL movies but include user's plan for frontend to show locks
        res.json({ success: true, movies: normalizedMovies, userPlan });

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

        const movie = {
            ...movies[0],
            subscription_required: movies[0].subscription_required === 'basic' ? 'premium' : movies[0].subscription_required
        };

        // Admins have full access without subscription checks
        if (req.user.role === 'admin') {
            return res.json({ success: true, movie });
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

        const effectivePlan = userSub[0]?.plan === 'basic' ? 'premium' : (userSub[0]?.plan || 'free');
        const userPlan = hasActiveMembership ? effectivePlan : 'free';

        // Check if user has access to this content
        const hasAccess =
            userPlan === 'premium' ||
            movie.subscription_required === 'free';

        if (!hasAccess) {
            const requiredPlan = movie.subscription_required;
            return res.status(403).json({ 
                success: false, 
                message: `This content requires ${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} subscription. Please upgrade to watch.`,
                requiredPlan: requiredPlan
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

        const [existing] = await db.query('SELECT * FROM movies WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Movie not found' });
        }

        // Use existing values as fallback if new values are not provided
        const title = req.body.title !== undefined && req.body.title !== '' 
            ? req.body.title 
            : existing[0].title;
        const description = req.body.description !== undefined 
            ? req.body.description 
            : existing[0].description;
        const genre = req.body.genre !== undefined && req.body.genre !== '' 
            ? req.body.genre 
            : existing[0].genre;
        const release_year = req.body.release_year !== undefined && req.body.release_year !== '' 
            ? req.body.release_year 
            : existing[0].release_year;
        const rating = req.body.rating !== undefined && req.body.rating !== '' 
            ? req.body.rating 
            : existing[0].rating;
        const subscription_required = req.body.subscription_required !== undefined 
            ? req.body.subscription_required 
            : existing[0].subscription_required;

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
             subscription_required, id]
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
