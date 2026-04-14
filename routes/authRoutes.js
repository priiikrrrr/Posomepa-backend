const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const otpController = require('../controllers/otpController');
const firebaseController = require('../controllers/firebaseController');
const auth = require('../middleware/authMiddleware');

router.post('/register', authController.register);
router.post('/login', authController.login);

router.post('/send-otp', otpController.sendOTP);
router.post('/verify-otp', otpController.verifyOTP);
router.post('/resend-otp', otpController.resendOTP);
router.post('/complete-registration', otpController.completeRegistration);

// Phone update endpoints (requires auth)
router.post('/send-phone-update-otp', auth, otpController.sendPhoneUpdateOTP);
router.post('/verify-phone-update-otp', auth, otpController.verifyPhoneUpdateOTP);

router.post('/verify-firebase-token', firebaseController.verifyFirebaseToken);
router.post('/verify-firebase-phone', authController.verifyFirebasePhone);
router.post('/register-with-phone', authController.registerWithPhone);

router.get('/me', auth, authController.getMe);
router.put('/profile', auth, authController.updateProfile);

// Debug endpoint - check user data by phone
router.get('/debug/user', auth, authController.debugUserByPhone);

module.exports = router;
