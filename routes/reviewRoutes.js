const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { addReview, getSpaceReviews, deleteReview } = require('../controllers/reviewController');

router.post('/', auth, addReview);
router.get('/space/:spaceId', getSpaceReviews);
router.delete('/:reviewId', auth, deleteReview);

module.exports = router;
