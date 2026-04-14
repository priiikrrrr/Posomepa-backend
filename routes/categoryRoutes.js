const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const auth = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');

router.get('/', categoryController.getAllCategories);
router.put('/bulk', categoryController.updateManyCategories);
router.post('/', auth, admin, categoryController.createCategory);
router.put('/:id', auth, admin, categoryController.updateCategory);
router.delete('/:id', auth, admin, categoryController.deleteCategory);

module.exports = router;
