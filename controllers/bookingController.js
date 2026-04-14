const Booking = require('../models/Booking');
const Space = require('../models/Space');
const mongoose = require('mongoose');

exports.createBooking = async (req, res) => {
  try {
    const { spaceId, date, startTime, endTime, amount, notes, termsAccepted } = req.body;

    if (!termsAccepted) {
      return res.status(400).json({ message: 'Please accept the terms and conditions to proceed' });
    }

    const space = await Space.findById(spaceId);
    if (!space) {
      return res.status(404).json({ message: 'Space not found' });
    }

    if (space.owner.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: 'You cannot book your own property' });
    }

    const bookingDate = new Date(date);
    // Normalize to midnight for date-only comparison
    const bookingDateStr = bookingDate.toISOString().split('T')[0];
    
    const isDateBlocked = space.blockedDates?.some(block => {
      const blockStart = new Date(block.startDate).toISOString().split('T')[0];
      const blockEnd = new Date(block.endDate).toISOString().split('T')[0];
      return bookingDateStr >= blockStart && bookingDateStr <= blockEnd;
    });
    
    if (isDateBlocked) {
      return res.status(400).json({ message: 'This date is not available' });
    }

    // Check for overlapping bookings - fetch all bookings for this date and check manually
    const dayStart = new Date(bookingDateStr + 'T00:00:00.000Z');
    const dayEnd = new Date(bookingDateStr + 'T23:59:59.999Z');
    
    // Clean up abandoned unpaid bookings older than 15 minutes
    await Booking.deleteMany({
      space: spaceId,
      paymentStatus: 'pending',
      status: 'requested',
      createdAt: { $lt: new Date(Date.now() - 15 * 60 * 1000) }
    });
    
    const existingBookings = await Booking.find({
      space: spaceId,
      date: { $gte: dayStart, $lte: dayEnd },
      status: { $in: ['requested', 'confirmed'] }
    });

    // Check for time overlap
    const hasOverlap = existingBookings.some(booking => {
      const existingStart = booking.startTime;
      const existingEnd = booking.endTime;
      
      const toMinutes = (time) => {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
      };
      
      const newStartMin = toMinutes(startTime);
      const newEndMin = toMinutes(endTime);
      const existStartMin = toMinutes(existingStart);
      const existEndMin = toMinutes(existingEnd);
      
      return newStartMin < existEndMin && newEndMin > existStartMin;
    });

    if (hasOverlap) {
      return res.status(400).json({ message: 'Time slot already booked for this property' });
    }

    const booking = new Booking({
      user: req.user._id,
      space: spaceId,
      date: new Date(date),
      startTime,
      endTime,
      amount,
      notes,
      termsAccepted: true,
      status: 'requested',
      paymentStatus: 'pending'
    });

    await booking.save();
    await booking.populate([
      { path: 'user', select: 'name email phone' },
      { path: 'space', select: 'title images location' }
    ]);

    res.status(201).json({ message: 'Booking created', booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMyBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    // Auto-complete confirmed bookings that have passed
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const confirmedBookings = await Booking.find({ status: 'confirmed' });
    
    for (const booking of confirmedBookings) {
      const bookingDate = new Date(booking.date).toISOString().split('T')[0];
      const [endHours, endMins] = booking.endTime.split(':').map(Number);
      const endTimeMinutes = endHours * 60 + endMins;
      
      // booking date is past, or today but end time has passed
      if (bookingDate < todayStr || (bookingDate === todayStr && currentTime > endTimeMinutes)) {
        booking.status = 'completed';
        await booking.save();
      }
    }
    
    const userId = new mongoose.Types.ObjectId(req.user._id);

    // Paid + refunded bookings (confirmed, completed, cancelled post-payment)
    const query = { 
      user: userId, 
      paymentStatus: { $in: ['paid', 'refunded'] }
    };
    if (status) query.status = status;

    // Separate query for pending/almost-booked (requested + never paid)
    const almostBookedQuery = {
      user: userId,
      status: 'requested',
      paymentStatus: 'pending'
    };

    const bookings = await Booking.find(query)
      .populate('space', 'title images location price priceType')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const almostBooked = await Booking.find(almostBookedQuery)
      .populate('space', 'title images location price priceType')
      .sort({ createdAt: -1 })
      .limit(5);

    const total = await Booking.countDocuments(query);

    res.json({
      bookings,
      almostBooked,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getBookingsBySpace = async (req, res) => {
  try {
    const { spaceId } = req.params;
    const { date } = req.query;

    const query = { space: spaceId, status: { $in: ['requested', 'confirmed'] } };
    if (date) {
      const bookingDate = new Date(date);
      const startOfDay = new Date(bookingDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(bookingDate.setHours(23, 59, 59, 999));
      query.date = { $gte: startOfDay, $lte: endOfDay };
    }

    const bookings = await Booking.find(query)
      .populate('user', 'name')
      .select('date startTime endTime status');

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('user', 'name email phone avatar')
      .populate('space', 'title images location price owner')
      .populate('space.owner', 'name email phone')
      .populate('propertyHostId', 'name email phone');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (!booking.user) {
      return res.status(404).json({ message: 'Booking has no owner' });
    }

    const isBooker = booking.user._id.toString() === req.user._id.toString();
    const isHost = booking.space?.owner?._id?.toString() === req.user._id.toString();
    const isPropertyHost = booking.propertyHostId?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isBooker && !isHost && !isPropertyHost && !isAdmin) {
      return res.status(403).json({ message: 'Access denied. Only the booker, property owner, or admin can view this booking.' });
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (!booking.user) {
      return res.status(404).json({ message: 'Booking has no owner' });
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied. You can only cancel your own bookings.' });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({ message: 'Cannot cancel completed booking' });
    }

    booking.status = 'cancelled';
    await booking.save();

    res.json({ message: 'Booking cancelled', booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    
    const query = {};
    if (status) query.status = status;
    
    if (search) {
      const spaces = await Space.find({ 
        title: { $regex: search, $options: 'i' } 
      }).select('_id');
      const spaceIds = spaces.map(s => s._id);
      query.$or = [
        { space: { $in: spaceIds } },
        { propertyTitle: { $regex: search, $options: 'i' } }
      ];
    }

    const bookings = await Booking.find(query)
      .populate('user', 'name email phone')
      .populate('space', 'title images location price')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Booking.countDocuments(query);

    res.json({
      bookings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['requested', 'confirmed', 'completed', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: Date.now() },
      { new: true }
    )
      .populate('user', 'name email phone')
      .populate('space', 'title images location price');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json({ message: 'Booking status updated', booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getHostBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    // Auto-complete confirmed bookings that have passed (for host too)
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const confirmedForAutoComplete = await Booking.find({ status: 'confirmed' });
    for (const booking of confirmedForAutoComplete) {
      const bookingDate = new Date(booking.date).toISOString().split('T')[0];
      const [endHours, endMins] = booking.endTime.split(':').map(Number);
      const endTimeMinutes = endHours * 60 + endMins;
      if (bookingDate < todayStr || (bookingDate === todayStr && currentTime > endTimeMinutes)) {
        booking.status = 'completed';
        await booking.save();
      }
    }
    
    const spaces = await Space.find({ owner: req.user._id }).select('_id');
    
    const spaceIds = spaces.map(s => s._id);
    const userId = req.user._id;
    
    const query = {
      $or: [
        { space: { $in: spaceIds } },
        { propertyHostId: userId.toString() },
        { propertyDeleted: true, propertyHostId: userId.toString() }
      ],
      paymentStatus: { $in: ['paid', 'refunded'] }
    };
    
    if (status) query.status = status;

    const bookings = await Booking.find(query)
      .populate('user', 'name email phone')
      .populate('space', 'title images location price owner')
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Booking.countDocuments(query);
    const totalBookings = total;
    const confirmedBookings = await Booking.countDocuments({ 
      $or: [
        { space: { $in: spaceIds }, status: { $in: ['confirmed', 'completed'] }, paymentStatus: 'paid' },
        { propertyHostId: userId.toString(), status: { $in: ['confirmed', 'completed'] }, paymentStatus: 'paid' },
        { propertyDeleted: true, propertyHostId: userId.toString(), status: { $in: ['confirmed', 'completed'] }, paymentStatus: 'paid' }
      ]
    });
    // Revenue counts ALL paid bookings (confirmed, completed, and cancelled-no-refund)
    const totalRevenue = await Booking.aggregate([
      { 
        $match: { 
          $or: [
            { space: { $in: spaceIds }, paymentStatus: 'paid' },
            { propertyHostId: userId.toString(), paymentStatus: 'paid' },
            { propertyDeleted: true, propertyHostId: userId.toString(), paymentStatus: 'paid' }
          ]
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.json({
      bookings,
      stats: {
        totalBookings,
        confirmedBookings,
        totalRevenue: totalRevenue[0]?.total || 0,
        totalProperties: spaces.length
      },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getBookingStats = async (req, res) => {
  try {
    const totalBookings = await Booking.countDocuments();
    const pendingBookings = await Booking.countDocuments({ status: 'requested' });
    const confirmedBookings = await Booking.countDocuments({ status: 'confirmed' });
    const completedBookings = await Booking.countDocuments({ status: 'completed' });
    const cancelledBookings = await Booking.countDocuments({ status: 'cancelled' });
    
    const revenueResult = await Booking.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    const recentBookings = await Booking.find()
      .populate('user', 'name')
      .populate('space', 'title')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      stats: {
        totalBookings,
        pendingBookings,
        confirmedBookings,
        completedBookings,
        cancelledBookings,
        totalRevenue
      },
      recentBookings
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// User requests cancellation
exports.requestCancellation = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ message: 'Only confirmed bookings can be cancelled' });
    }

    if (booking.paymentStatus !== 'paid') {
      return res.status(400).json({ message: 'Only paid bookings can be cancelled' });
    }

    // User can request cancellation anytime - 2hr rule only applies to refund eligibility (in approveCancellation)
    booking.status = 'cancellation_requested';
    booking.cancellationRequestedAt = new Date();
    await booking.save();

    res.json({ message: 'Cancellation request submitted', booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin approves cancellation & initiates refund
exports.approveCancellation = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.status !== 'cancellation_requested') {
      return res.status(400).json({ message: 'No cancellation request found for this booking' });
    }

    // Check if booking is more than 2 hours away (using local time)
    const bookingDate = new Date(booking.date);
    const [startHours, startMins] = booking.startTime.split(':').map(Number);
    bookingDate.setHours(startHours, startMins, 0, 0);
    const bookingStartMs = bookingDate.getTime();
    const twoHoursFromNow = Date.now() + (2 * 60 * 60 * 1000);

    // Only allow refund if more than 2 hours away
    if (bookingStartMs <= twoHoursFromNow) {
      return res.status(400).json({ 
        message: 'Booking is within 2 hours — use Cancel, No Refund instead' 
      });
    }

    // Initiate refund only if eligible (PRODUCTION)
    // if (process.env.TEST_MODE !== 'true' && booking.paymentId) {
    //   const Razorpay = require('razorpay');
    //   const razorpay = new Razorpay({
    //     key_id: process.env.RAZORPAY_KEY_ID,
    //     key_secret: process.env.RAZORPAY_KEY_SECRET
    //   });
    //   try {
    //     await razorpay.payments.refund(booking.paymentId, {
    //       amount: Math.round(booking.amount * 100)
    //     });
    //   } catch (refundError) {
    //     return res.status(500).json({ message: 'Refund failed: ' + refundError.message });
    //   }
    // }

    booking.status = 'cancelled';
    booking.paymentStatus = 'refunded';
    booking.cancellationApprovedAt = new Date();
    await booking.save();

    res.json({ 
      message: 'Cancellation approved and refund initiated',
      booking,
      refundIssued: true
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin rejects cancellation request
exports.rejectCancellation = async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.status !== 'cancellation_requested') {
      return res.status(400).json({ message: 'No cancellation request found' });
    }

    booking.status = 'confirmed';
    booking.cancellationRejectedAt = new Date();
    booking.cancellationRejectionReason = reason || 'Request rejected by admin';
    await booking.save();

    res.json({ message: 'Cancellation request rejected', booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin approves cancellation with no refund (within 2 hours)
exports.approveCancellationNoRefund = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.status !== 'cancellation_requested') {
      return res.status(400).json({ message: 'No cancellation request found for this booking' });
    }

    // Double check — block if refund is actually eligible (using local time)
    const bookingDate = new Date(booking.date);
    const [startHours, startMins] = booking.startTime.split(':').map(Number);
    bookingDate.setHours(startHours, startMins, 0, 0);
    const bookingStartMs = bookingDate.getTime();
    const twoHoursFromNow = Date.now() + (2 * 60 * 60 * 1000);

    if (bookingStartMs > twoHoursFromNow) {
      return res.status(400).json({ 
        message: 'Booking is more than 2 hours away — use Cancel & Refund instead' 
      });
    }

    booking.status = 'cancelled';
    booking.paymentStatus = 'paid'; // no refund
    booking.cancellationApprovedAt = new Date();
    await booking.save();

    res.json({ 
      message: 'Booking cancelled, no refund issued',
      booking,
      refundIssued: false
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
