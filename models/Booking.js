const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  space: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Space',
    default: null
  },
  propertyDeleted: {
    type: Boolean,
    default: false
  },
  propertyTitle: {
    type: String,
    default: ''
  },
  propertyLocation: {
    type: String,
    default: ''
  },
  propertyHostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['requested', 'confirmed', 'completed', 'cancelled', 'cancellation_requested'],
    default: 'requested'
  },
  cancellationRequestedAt: {
    type: Date
  },
  cancellationApprovedAt: {
    type: Date
  },
  cancellationRejectedAt: {
    type: Date
  },
  cancellationRejectionReason: {
    type: String,
    default: ''
  },
  paymentId: {
    type: String,
    default: ''
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  amount: {
    type: Number,
    required: true
  },
  notes: {
    type: String,
    default: ''
  },
  termsAccepted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

bookingSchema.index({ user: 1 });
bookingSchema.index({ space: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ date: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
