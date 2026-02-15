const express = require('express');
const router = express.Router();
const musicController = require('../controllers/musicController');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

// User routes (protected)
router.get('/', verifyToken, musicController.getAllMusic);
router.get('/genres', verifyToken, musicController.getGenres);
router.get('/:id', verifyToken, musicController.getMusic);

// Admin routes
router.post('/', verifyToken, verifyAdmin, upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'poster', maxCount: 1 }
]), musicController.addMusic);

router.put('/:id', verifyToken, verifyAdmin, upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'poster', maxCount: 1 }
]), musicController.updateMusic);

router.delete('/:id', verifyToken, verifyAdmin, musicController.deleteMusic);

module.exports = router;
