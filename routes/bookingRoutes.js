const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const auth = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');

router.post('/', auth, bookingController.createBooking);
router.get('/my', auth, bookingController.getMyBookings);
router.get('/host', auth, bookingController.getHostBookings);
router.get('/space/:spaceId', bookingController.getBookingsBySpace);
router.get('/stats', admin, bookingController.getBookingStats);
router.get('/admin', admin, bookingController.getAllBookings);
router.get('/:id', auth, bookingController.getBookingById);
router.put('/:id/status', admin, bookingController.updateBookingStatus);
router.delete('/:id', auth, bookingController.cancelBooking);

// Cancellation routes
router.post('/:id/request-cancellation', auth, bookingController.requestCancellation);
router.post('/:id/approve-cancellation', admin, bookingController.approveCancellation);
router.post('/:id/approve-cancellation-no-refund', admin, bookingController.approveCancellationNoRefund);
router.post('/:id/reject-cancellation', admin, bookingController.rejectCancellation);

module.exports = router;
