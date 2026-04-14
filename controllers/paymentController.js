const Razorpay = require('razorpay');
const Booking = require('../models/Booking');

const getRazorpay = () => {
  if (process.env.TEST_MODE === 'true') {
    return null;
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
};

exports.createOrder = async (req, res) => {
  try {
    let { bookingId } = req.body;
    if (bookingId && typeof bookingId === 'object' && bookingId.bookingId) {
      bookingId = bookingId.bookingId;
    }

    console.log('createOrder - TEST_MODE:', process.env.TEST_MODE);
    console.log('createOrder - bookingId:', bookingId);
    console.log('createOrder - userId:', req.user._id);

    const booking = await Booking.findById(bookingId)
      .populate('space', 'title');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (!booking.user) {
      return res.status(400).json({ message: 'Booking has no user associated' });
    }

    const bookingUserId = String(booking.user);
    const requestUserId = String(req.user._id);

    console.log('createOrder - bookingUserId:', bookingUserId);
    console.log('createOrder - requestUserId:', requestUserId);

    if (bookingUserId !== requestUserId) {
      return res.status(403).json({ message: 'Access denied. You can only pay for your own bookings.' });
    }

    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Booking already paid' });
    }

    const amount = Math.round(booking.amount * 100);

    let order;
    
    if (process.env.TEST_MODE === 'true') {
      console.log('TEST_MODE: Creating mock order');
      order = {
        id: 'order_test_' + Date.now(),
        amount: amount,
        currency: 'INR'
      };
    } else {
      const razorpay = getRazorpay();
      if (!razorpay) {
        return res.status(500).json({ message: 'Razorpay not configured' });
      }
      const options = {
        amount,
        currency: 'INR',
        receipt: `receipt_${booking._id}`,
        notes: {
          bookingId: booking._id.toString(),
          spaceTitle: booking.space.title
        }
      };
      order = await razorpay.orders.create(options);
    }

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      bookingId: booking._id,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    let { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;
    if (bookingId && typeof bookingId === 'object' && bookingId.bookingId) {
      bookingId = bookingId.bookingId;
    }

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (process.env.TEST_MODE === 'true') {
      booking.paymentId = razorpay_payment_id;
      booking.paymentStatus = 'paid';
      booking.status = 'confirmed';
      await booking.save();
      return res.json({ message: 'Payment successful (Test Mode)', booking });
    }

    const razorpay = getRazorpay();
    if (!razorpay) {
      return res.status(500).json({ message: 'Razorpay not configured' });
    }

    const generatedSignature = razorpay.utils.verifyPaymentSignature(
      `${razorpay_order_id}|${razorpay_payment_id}`,
      razorpay_signature
    );

    if (!generatedSignature) {
      booking.paymentStatus = 'failed';
      await booking.save();
      return res.status(400).json({ message: 'Invalid payment signature' });
    }

    booking.paymentId = razorpay_payment_id;
    booking.paymentStatus = 'paid';
    booking.status = 'confirmed';
    await booking.save();

    res.json({ message: 'Payment successful', booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.webhook = async (req, res) => {
  try {
    const webhookBody = req.body;
    
    if (webhookBody.event === 'payment.captured') {
      const payment = webhookBody.payload.payment.entity;
      const receipt = payment.notes.bookingId;
      
      if (receipt) {
        await Booking.findByIdAndUpdate(receipt, {
          paymentStatus: 'paid',
          status: 'confirmed'
        });
      }
    }

    res.json({ received: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
