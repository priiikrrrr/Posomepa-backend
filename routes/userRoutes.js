const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');

router.get('/', auth, admin, userController.getAllUsers);
router.get('/stats', auth, admin, userController.getUserStats);
router.get('/:id', auth, userController.getUserById);
router.put('/:id/role', auth, admin, userController.updateUserRole);
router.delete('/:id', auth, admin, userController.deleteUser);

module.exports = router;
