const jwt = require('jsonwebtoken');
const OTP = require('../models/OTP');
const User = require('../models/User');
// const twilioService = require('../services/twilioService'); // Using Firebase OTP instead

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const addDeviceToken = (user, token) => {
  if (!token) return;
  
  const tokenObj = { token, platform: 'android', addedAt: new Date() };
  
  const exists = user.deviceTokens.some(dt => dt.token === token);
  if (!exists) {
    user.deviceTokens.push(tokenObj);
  }
};

exports.sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
    
    const existingOTP = await OTP.findOne({ phone: formattedPhone, verified: false });
    if (existingOTP && existingOTP.attempts >= 5) {
      return res.status(400).json({ message: 'Too many attempts. Please try again later.' });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await OTP.findOneAndDelete({ phone: formattedPhone, verified: false });

    const newOTP = new OTP({
      phone: formattedPhone,
      otp,
      expiresAt,
      attempts: 0
    });
    await newOTP.save();

    res.status(200).json({ 
      message: 'Using Firebase OTP for phone verification',
      dev: false
    });
  } catch (error) {
    console.error('Send OTP Error:', error);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { phone, otp, name, email, fcmToken } = req.body;
    
    if (!phone || !otp) {
      return res.status(400).json({ message: 'Phone and OTP are required' });
    }

    const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
    
    const otpRecord = await OTP.findOne({ 
      phone: formattedPhone, 
      otp,
      verified: false 
    });

    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (otpRecord.expiresAt < new Date()) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    otpRecord.verified = true;
    await otpRecord.save();

    let user = await User.findOne({ phone: formattedPhone });
    
    if (!user) {
      if (!name || !email) {
        return res.status(200).json({ 
          message: 'OTP verified. Please provide name and email to complete registration.',
          phone: formattedPhone,
          requiresRegistration: true
        });
      }

      const deviceTokens = fcmToken ? [{ token: fcmToken, platform: 'android', addedAt: new Date() }] : [];
      
      user = new User({
        phone: formattedPhone,
        name,
        email: email.toLowerCase(),
        role: 'user',
        deviceTokens
      });
      await user.save();
    } else {
      addDeviceToken(user, fcmToken);
      await user.save();
    }

    const token = generateToken(user._id);

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar
      },
      requiresRegistration: false
    });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({ message: 'Failed to verify OTP' });
  }
};

exports.resendOTP = async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
    
    await OTP.findOneAndDelete({ phone: formattedPhone, verified: false });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const newOTP = new OTP({
      phone: formattedPhone,
      otp,
      expiresAt,
      attempts: 0
    });
    await newOTP.save();

    // Firebase handles OTP delivery
    res.status(200).json({ 
      message: 'OTP resent successfully'
    });
  } catch (error) {
    console.error('Resend OTP Error:', error);
    res.status(500).json({ message: 'Failed to resend OTP' });
  }
};

exports.completeRegistration = async (req, res) => {
  try {
    const { phone, name, email, fcmToken } = req.body;
    
    if (!phone || !name || !email) {
      return res.status(400).json({ message: 'Phone, name, and email are required' });
    }

    const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
    const lowerEmail = email.toLowerCase();

    let user = await User.findOne({ phone: formattedPhone });
    
    if (user) {
      user.name = name;
      user.email = lowerEmail;
      addDeviceToken(user, fcmToken);
      await user.save();
      
      const token = generateToken(user._id);
      return res.status(200).json({
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          avatar: user.avatar
        }
      });
    }

    user = await User.findOne({ email: lowerEmail });
    if (user) {
      if (user.phone && user.phone !== formattedPhone && user.phone !== '') {
        return res.status(400).json({ message: 'This email is already associated with another phone number' });
      }
      user.phone = formattedPhone;
      user.name = name;
      addDeviceToken(user, fcmToken);
      await user.save();
      
      const token = generateToken(user._id);
      return res.status(200).json({
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          avatar: user.avatar
        }
      });
    }

    const deviceTokens = fcmToken ? [{ token: fcmToken, platform: 'android', addedAt: new Date() }] : [];
    
    user = new User({
      phone: formattedPhone,
      name,
      email: lowerEmail,
      role: 'user',
      deviceTokens
    });
    await user.save();

    const token = generateToken(user._id);

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Complete Registration Error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Phone number already registered with another account' });
    }
    res.status(500).json({ message: 'Failed to complete registration: ' + error.message });
  }
};

// Send OTP for phone update (for authenticated users)
exports.sendPhoneUpdateOTP = async (req, res) => {
  try {
    const { phone } = req.body;
    const userId = req.user._id;
    
    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // Check if phone is already in use by another user
    const existingUser = await User.findOne({ phone, _id: { $ne: userId } });
    if (existingUser) {
      return res.status(400).json({ message: 'Phone number already in use' });
    }

    const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
    
    const existingOTP = await OTP.findOne({ phone: formattedPhone, verified: false });
    if (existingOTP && existingOTP.attempts >= 5) {
      return res.status(400).json({ message: 'Too many attempts. Please try again later.' });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await OTP.findOneAndDelete({ phone: formattedPhone, verified: false });

    const newOTP = new OTP({
      phone: formattedPhone,
      otp,
      expiresAt,
      attempts: 0
    });
    await newOTP.save();
    
    res.status(200).json({ 
      message: 'OTP sent successfully',
      dev: process.env.NODE_ENV === 'development'
    });
  } catch (error) {
    console.error('Send Phone Update OTP Error:', error);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
};

// Verify OTP and update phone
exports.verifyPhoneUpdateOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    const userId = req.user._id;
    
    if (!phone || !otp) {
      return res.status(400).json({ message: 'Phone and OTP are required' });
    }

    const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
    
    const otpRecord = await OTP.findOne({ 
      phone: formattedPhone, 
      otp,
      verified: false 
    });

    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (otpRecord.expiresAt < new Date()) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    // Check if phone is already in use by another user
    const existingUser = await User.findOne({ phone: formattedPhone, _id: { $ne: userId } });
    if (existingUser) {
      return res.status(400).json({ message: 'Phone number already in use' });
    }

    otpRecord.verified = true;
    await otpRecord.save();

    // Update user's phone
    const user = await User.findByIdAndUpdate(
      userId,
      { phone: formattedPhone, phoneVerified: true },
      { new: true }
    );

    res.status(200).json({
      message: 'Phone updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        phoneVerified: user.phoneVerified
      }
    });
  } catch (error) {
    console.error('Verify Phone Update OTP Error:', error);
    res.status(500).json({ message: 'Failed to verify OTP' });
  }
};
