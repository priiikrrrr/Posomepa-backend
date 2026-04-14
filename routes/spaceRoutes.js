const express = require('express');
const router = express.Router();
const spaceController = require('../controllers/spaceController');
const auth = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');

router.get('/', spaceController.getAllSpaces);
router.get('/featured', spaceController.getFeaturedSpaces);
router.get('/category/:categoryId', spaceController.getSpacesByCategory);
router.get('/my', auth, spaceController.getMySpaces);
router.get('/:id', spaceController.getSpaceById);
router.get('/:id/blocked-dates', spaceController.getBlockedDates);
router.post('/', auth, spaceController.createSpace);
router.put('/:id', auth, spaceController.updateSpace);
router.put('/:id/blocked-dates', auth, spaceController.updateBlockedDates);
router.delete('/:id', auth, spaceController.deleteSpace);

module.exports = router;
