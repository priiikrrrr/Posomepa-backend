const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/authMiddleware');

router.post('/create-order', auth, paymentController.createOrder);
router.post('/verify', auth, paymentController.verifyPayment);
router.post('/webhook', paymentController.webhook);

module.exports = router;
