const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const auth = require('../middleware/authMiddleware');

router.post('/', auth, messageController.sendMessage);
router.get('/', auth, messageController.getMyMessages);
router.get('/host', auth, messageController.getHostMessages);
router.get('/unread', auth, messageController.getUnreadCount);
router.put('/:id/read', auth, messageController.markAsRead);
router.put('/read-all', auth, messageController.markAllAsRead);
router.post('/:id/reply', auth, messageController.replyToMessage);
router.delete('/:id', auth, messageController.deleteMessage);

module.exports = router;
