const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');
const auth = require('../middleware/authMiddleware');

router.get('/content', auth, recommendationController.getContentBased);
router.get('/collaborative', auth, recommendationController.getCollaborative);
router.get('/hybrid', recommendationController.getHybrid);

module.exports = router;
