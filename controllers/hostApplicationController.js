const HostApplication = require('../models/HostApplication');
const User = require('../models/User');
const emailService = require('../services/emailService');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

// Submit host application
exports.submitApplication = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check if user already has an application
    const existingApplication = await HostApplication.findOne({ user: userId });
    if (existingApplication) {
      return res.status(400).json({ 
        message: 'You already have an application. Current status: ' + existingApplication.status 
      });
    }

    // Get Cloudinary URLs from uploaded files
    const files = req.files || {};
    const idImageUrl = files.idImage?.[0]?.path || '';
    const selfieUrl = files.selfie?.[0]?.path || '';
    const addressProofUrl = files.addressProof?.[0]?.path || '';
    const businessProofUrl = files.businessProof?.[0]?.path || '';

    const applicationData = {
      user: userId,
      fullName: req.body.fullName,
      email: req.body.email,
      alternateEmail: req.body.alternateEmail || '',
      phone: req.body.phone,
      alternatePhone: req.body.alternatePhone || '',
      serviceType: req.body.serviceType,
      area: req.body.area,
      idType: req.body.idType,
      idNumber: req.body.idNumber,
      idImageUrl,
      address: req.body.address,
      city: req.body.city,
      state: req.body.state,
      pincode: req.body.pincode,
      addressProofUrl,
      selfieUrl,
      businessProofUrl,
      bankAccountNumber: req.body.bankAccountNumber,
      ifscCode: req.body.ifscCode,
      bankBranch: req.body.bankBranch,
      bankName: req.body.bankName,
      upiId: req.body.upiId || '',
      status: 'pending'
    };

    const application = new HostApplication(applicationData);
    await application.save();

    // Update user status
    await User.findByIdAndUpdate(userId, { hostApplicationStatus: 'pending' });

    res.status(201).json({
      message: 'Application submitted successfully',
      application: {
        id: application._id,
        status: application.status,
        submittedAt: application.createdAt
      }
    });
  } catch (error) {
    console.error('Submit application error:', error);
    res.status(500).json({ message: 'Failed to submit application' });
  }
};

// Get user's own application
exports.getMyApplication = async (req, res) => {
  try {
    const userId = req.user._id;
    const application = await HostApplication.findOne({ user: userId });

    if (!application) {
      return res.json({ application: null });
    }

    res.json({ application });
  } catch (error) {
    console.error('Get my application error:', error);
    res.status(500).json({ message: 'Failed to get application' });
  }
};

// Get all applications (Admin)
exports.getAllApplications = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const applications = await HostApplication.find(query)
      .populate('user', 'name email phone avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await HostApplication.countDocuments(query);

    // Get stats
    const stats = {
      total: await HostApplication.countDocuments(),
      pending: await HostApplication.countDocuments({ status: 'pending' }),
      verified: await HostApplication.countDocuments({ status: 'verified' }),
      rejected: await HostApplication.countDocuments({ status: 'rejected' })
    };

    res.json({
      applications,
      stats,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get all applications error:', error);
    res.status(500).json({ message: 'Failed to get applications' });
  }
};

// Get single application (Admin)
exports.getApplicationById = async (req, res) => {
  try {
    const application = await HostApplication.findById(req.params.id)
      .populate('user', 'name email phone avatar');

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    res.json({ application });
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({ message: 'Failed to get application' });
  }
};

// Approve application (Admin)
exports.approveApplication = async (req, res) => {
  try {
    const application = await HostApplication.findById(req.params.id)
      .populate('user', 'name email');

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ 
        message: 'Application has already been processed. Current status: ' + application.status 
      });
    }

    // Update application
    application.status = 'verified';
    application.verifiedAt = new Date();
    application.reviewedBy = req.user._id;
    application.reviewedAt = new Date();
    await application.save();

    // Update user status
    await User.findByIdAndUpdate(application.user._id, { 
      hostApplicationStatus: 'verified',
      role: 'host'
    });

    // Send approval email
    await emailService.sendApprovalEmail(application.email, application.fullName);

    res.json({
      message: 'Application approved successfully',
      application
    });
  } catch (error) {
    console.error('Approve application error:', error);
    res.status(500).json({ message: 'Failed to approve application' });
  }
};

// Reject application (Admin)
exports.rejectApplication = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    const application = await HostApplication.findById(req.params.id)
      .populate('user', 'name email');

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ 
        message: 'Application has already been processed. Current status: ' + application.status 
      });
    }

    // Update application
    application.status = 'rejected';
    application.rejectionReason = reason;
    application.rejectedAt = new Date();
    application.reviewedBy = req.user._id;
    application.reviewedAt = new Date();
    // Allow resubmit after 2 hours
    application.canResubmitAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    await application.save();

    // Update user status
    await User.findByIdAndUpdate(application.user._id, { 
      hostApplicationStatus: 'rejected'
    });

    // Send rejection email
    await emailService.sendRejectionEmail(application.email, application.fullName, reason);

    res.json({
      message: 'Application rejected successfully',
      application
    });
  } catch (error) {
    console.error('Reject application error:', error);
    res.status(500).json({ message: 'Failed to reject application' });
  }
};

// Resubmit application (User)
exports.resubmitApplication = async (req, res) => {
  try {
    const userId = req.user._id;
    const application = await HostApplication.findOne({ user: userId });

    if (!application) {
      return res.status(404).json({ message: 'No application found to resubmit' });
    }

    if (application.status !== 'rejected') {
      return res.status(400).json({ 
        message: 'Only rejected applications can be resubmitted' 
      });
    }

    // Check if 2 hours have passed
    if (application.canResubmitAt && new Date() < application.canResubmitAt) {
      const hoursLeft = Math.ceil((application.canResubmitAt - new Date()) / (60 * 60 * 1000));
      return res.status(400).json({ 
        message: `You can resubmit after ${hoursLeft} hours` 
      });
    }

    // Reset application for resubmission
    application.status = 'pending';
    application.rejectionReason = '';
    application.rejectedAt = null;
    application.canResubmitAt = null;
    await application.save();

    // Update user status
    await User.findByIdAndUpdate(userId, { hostApplicationStatus: 'pending' });

    res.json({
      message: 'Application resubmitted successfully',
      application
    });
  } catch (error) {
    console.error('Resubmit application error:', error);
    res.status(500).json({ message: 'Failed to resubmit application' });
  }
};

// Get user's rejection info for frontend check (Step 1)
exports.getRejectionInfo = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Find most recent rejected application
    const application = await HostApplication.findOne({ user: userId })
      .sort({ rejectedAt: -1 });
    
    if (!application || application.status !== 'rejected') {
      return res.json({ canApply: true });
    }
    
    const now = new Date();
    const canResubmitAt = application.canResubmitAt;
    const canResubmit = now >= canResubmitAt;
    
    // Calculate hours remaining
    const hoursRemaining = canResubmitAt 
      ? Math.max(0, Math.ceil((canResubmitAt - now) / (60 * 60 * 1000)))
      : 0;
    
    const minutesRemaining = canResubmitAt
      ? Math.max(0, Math.ceil((canResubmitAt - now) / (60 * 1000)))
      : 0;
    
    // Format time remaining nicely
    let timeRemaining = '';
    if (!canResubmit) {
      if (hoursRemaining >= 1) {
        timeRemaining = `${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''}`;
      } else {
        timeRemaining = `${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}`;
      }
    }
    
    res.json({
      canApply: canResubmit,
      rejectionReason: application.rejectionReason || 'Your application was rejected',
      canResubmitAt: canResubmitAt,
      timeRemaining: timeRemaining,
      hoursRemaining: hoursRemaining,
      minutesRemaining: minutesRemaining
    });
  } catch (error) {
    console.error('Get rejection info error:', error);
    res.status(500).json({ message: 'Failed to get rejection info' });
  }
};
