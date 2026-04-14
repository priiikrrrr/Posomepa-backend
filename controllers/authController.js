const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { admin } = require('../services/firebaseService');
const User = require('../models/User');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

exports.register = async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = new User({
      email,
      password,
      name,
      phone: phone || undefined,
      role: 'user'
    });

    await user.save();

    const token = generateToken(user._id);

    res.status(201).json({
      message: 'Registration successful',
      token,
      user
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!user.password) {
      return res.status(400).json({ message: 'Please login with Google' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    res.json({
      message: 'Login successful',
      token,
      user
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, avatar } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone, avatar, updatedAt: Date.now() },
      { new: true }
    );

    res.json({ message: 'Profile updated', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Debug endpoint to check user data by phone
exports.debugUserByPhone = async (req, res) => {
  try {
    const { phone } = req.query;
    
    if (!phone) {
      return res.status(400).json({ message: 'Phone number required' });
    }
    
    const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
    
    const user = await User.findOne({ phone: formattedPhone });
    
    if (!user) {
      return res.json({ 
        message: 'No user found with this phone',
        phone: formattedPhone,
        user: null 
      });
    }
    
    // Get spaces owned by this user
    const Space = require('../models/Space');
    const Booking = require('../models/Booking');
    
    const spaces = await Space.find({ owner: user._id });
    const spaceIds = spaces.map(s => s._id);
    
    // Get bookings for this user's spaces
    const bookings = await Booking.find({ 
      $or: [
        { space: { $in: spaceIds } },
        { user: user._id },
        { propertyHostId: user._id.toString() }
      ]
    }).populate('space', 'title').populate('user', 'name');
    
    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        phoneVerified: user.phoneVerified,
        role: user.role
      },
      spaces: spaces.map(s => ({ _id: s._id, title: s.title })),
      bookings: bookings.map(b => ({
        _id: b._id,
        space: b.space?.title || 'Deleted',
        date: b.date,
        status: b.status,
        amount: b.amount,
        userName: b.user?.name || 'Unknown'
      })),
      stats: {
        totalSpaces: spaces.length,
        totalBookings: bookings.length
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Verify Firebase phone token and login/register
exports.verifyFirebasePhone = async (req, res) => {
  try {
    const { idToken, phone, uid, existingToken, existingUserId, existingEmail, existingName } = req.body;

    // Verify the Firebase ID token
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (firebaseError) {
      return res.status(401).json({ message: 'Invalid Firebase token' });
    }

    // Check if phone matches
    if (decodedToken.phone_number !== phone) {
      return res.status(401).json({ message: 'Phone number mismatch' });
    }

    // Check if this phone is already linked to a different user
    const phoneExistingUser = await User.findOne({ phone });
    if (phoneExistingUser && existingUserId && phoneExistingUser._id.toString() !== existingUserId) {
      return res.status(400).json({ 
        message: 'This phone number is already linked to another account' 
      });
    }

    // PRIORITY 1: If user is already logged in (existingUserId), find them by ID
    // This is for Google users who want to add phone verification
    let user = null;
    if (existingUserId) {
      user = await User.findById(existingUserId);
    }

    // PRIORITY 2: If no existing user, check by phone number
    // This is for phone-only users
    if (!user) {
      user = phoneExistingUser;
    }

    // PRIORITY 3: If still no user, check by email
    if (!user && existingEmail) {
      user = await User.findOne({ email: existingEmail.toLowerCase() });
    }

    if (!user) {
      // New user - needs registration
      // But if we have existing user info, we can pre-fill
      return res.json({ 
        requiresRegistration: true, 
        phone,
        uid: decodedToken.sub,
        suggestedName: existingName || '',
        suggestedEmail: existingEmail || '',
        existingUserId: existingUserId || null
      });
    }

    // Existing user - ONLY update phone and phoneVerified
    // DO NOT change firebaseUid - Google and Phone have different Firebase UIDs
    user.phone = phone;
    user.phoneVerified = true;
    user.updatedAt = Date.now();
    await user.save();
    
    const updatedUser = await User.findById(user._id);
    const jwtToken = generateToken(user._id);

    res.json({
      message: 'Phone verification successful',
      token: jwtToken,
      user: updatedUser
    });
  } catch (error) {
    res.status(500).json({ message: 'Phone verification failed' });
  }
};

// Register new user with phone
exports.registerWithPhone = async (req, res) => {
  try {
    const { phone, name, email, uid, existingUserId, existingEmail } = req.body;

    // If existingUserId is provided, find and link the phone to the existing user
    if (existingUserId) {
      const existingUser = await User.findById(existingUserId);
      if (existingUser) {
        existingUser.phone = phone;
        existingUser.firebaseUid = uid || existingUser.firebaseUid;
        existingUser.phoneVerified = true;
        existingUser.updatedAt = Date.now();
        // Only update name if user doesn't have one (preserve Google name)
        if (!existingUser.name || existingUser.name === 'User' || existingUser.name.startsWith('USER')) {
          existingUser.name = name || existingUser.name;
        }
        // Only update email if user doesn't have one
        if (!existingUser.email && email) {
          existingUser.email = email.toLowerCase();
        }
        await existingUser.save();
        
        const jwtToken = generateToken(existingUser._id);
        return res.json({
          message: 'Phone linked to existing account',
          token: jwtToken,
          user: existingUser
        });
      }
    }

    // Check if phone already exists - link to it if so
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      // Update the existing user with Firebase UID and verify phone
      if (uid && !existingPhone.firebaseUid) {
        existingPhone.firebaseUid = uid;
      }
      existingPhone.phoneVerified = true;
      existingPhone.updatedAt = Date.now();
      await existingPhone.save();
      
      const jwtToken = generateToken(existingPhone._id);
      return res.json({
        message: 'Phone linked to existing account',
        token: jwtToken,
        user: existingPhone
      });
    }

    // Check if firebaseUid already exists - link phone to existing user
    if (uid) {
      const existingUid = await User.findOne({ firebaseUid: uid });
      if (existingUid) {
        existingUid.phone = phone;
        existingUid.phoneVerified = true;
        existingUid.updatedAt = Date.now();
        await existingUid.save();
        
        const jwtToken = generateToken(existingUid._id);
        return res.json({
          message: 'Phone linked to existing account',
          token: jwtToken,
          user: existingUid
        });
      }
    }

    // Check if email already exists (also check existingEmail if provided)
    const emailToCheck = email?.toLowerCase() || existingEmail?.toLowerCase();
    if (emailToCheck) {
      const existingEmailUser = await User.findOne({ email: emailToCheck });
      if (existingEmailUser) {
        // Link phone to existing user
        existingEmailUser.phone = phone;
        if (uid) existingEmailUser.firebaseUid = uid;
        existingEmailUser.phoneVerified = true;
        existingEmailUser.updatedAt = Date.now();
        await existingEmailUser.save();
        
        const jwtToken = generateToken(existingEmailUser._id);
        return res.json({
          message: 'Phone linked to existing account',
          token: jwtToken,
          user: existingEmailUser
        });
      }
    }

    // Create new user
    const user = new User({
      email: email || null,
      name,
      phone,
      firebaseUid: uid || null,
      phoneVerified: true,
      role: 'user'
    });

    await user.save();

    const jwtToken = generateToken(user._id);

    res.status(201).json({
      message: 'Registration successful',
      token: jwtToken,
      user
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
