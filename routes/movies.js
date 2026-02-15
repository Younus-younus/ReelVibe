const express = require('express');
const router = express.Router();
const movieController = require('../controllers/movieController');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

// User routes (protected)
router.get('/', verifyToken, movieController.getAllMovies);
router.get('/genres', verifyToken, movieController.getGenres);
router.get('/:id', verifyToken, movieController.getMovie);

// Admin routes
router.post('/', verifyToken, verifyAdmin, upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'poster', maxCount: 1 }
]), movieController.addMovie);

router.put('/:id', verifyToken, verifyAdmin, upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'poster', maxCount: 1 }
]), movieController.updateMovie);

router.delete('/:id', verifyToken, verifyAdmin, movieController.deleteMovie);

module.exports = router;
