const mongoose = require('mongoose');

const hostApplicationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  // Basic Info
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  alternateEmail: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },
  phone: {
    type: String,
    required: true
  },
  alternatePhone: {
    type: String,
    default: ''
  },
  
  // Service Type
  serviceType: {
    type: String,
    enum: ['personal', 'business'],
    required: true
  },
  area: {
    type: String,
    required: true,
    trim: true
  },
  
  // Identity Verification
  idType: {
    type: String,
    enum: ['pan', 'aadhaar', 'passport'],
    required: true
  },
  idNumber: {
    type: String,
    required: true,
    trim: true
  },
  idImageUrl: {
    type: String,
    required: true
  },
  
  // Address
  address: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    required: true,
    trim: true
  },
  pincode: {
    type: String,
    required: true,
    trim: true
  },
  addressProofUrl: {
    type: String,
    default: ''
  },
  
  // Selfie
  selfieUrl: {
    type: String,
    required: true
  },
  
  // Business Proof (if business)
  businessProofUrl: {
    type: String,
    default: ''
  },
  
  // Payment Details
  bankAccountNumber: {
    type: String,
    required: true,
    trim: true
  },
  ifscCode: {
    type: String,
    required: true,
    trim: true
  },
  bankBranch: {
    type: String,
    required: true,
    trim: true
  },
  bankName: {
    type: String,
    required: true,
    trim: true
  },
  upiId: {
    type: String,
    default: '',
    trim: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  rejectedAt: {
    type: Date
  },
  verifiedAt: {
    type: Date
  },
  
  // Admin Review
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  
  // Rejection lock (14 hours)
  canResubmitAt: {
    type: Date
  }
}, { timestamps: true });

// Index for faster queries
hostApplicationSchema.index({ status: 1, createdAt: -1 });
hostApplicationSchema.index({ user: 1 });

module.exports = mongoose.model('HostApplication', hostApplicationSchema);
