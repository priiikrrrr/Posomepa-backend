const Space = require('../models/Space');
const Booking = require('../models/Booking');

exports.getAllSpaces = async (req, res) => {
  try {
    const { 
      category, 
      city, 
      priceMin, 
      priceMax, 
      search, 
      sort, 
      page = 1, 
      limit = 50,
      featured 
    } = req.query;

    const query = { isActive: true };

    if (category) {
      const Category = require('../models/Category');
      const categoryDoc = await Category.findOne({ 
        name: { $regex: new RegExp(`^${category}$`, 'i') }
      });
      if (categoryDoc) {
        query.category = categoryDoc._id;
      } else {
        return res.json({ spaces: [], total: 0, page: 1, limit: 50 });
      }
    }

    if (city) query['location.city'] = new RegExp(city, 'i');
    if (priceMin || priceMax) {
      query.price = {};
      if (priceMin) query.price.$gte = Number(priceMin);
      if (priceMax) query.price.$lte = Number(priceMax);
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'location.city': { $regex: search, $options: 'i' } },
      ];
    }
    if (featured === 'true') query.featured = true;

    let sortOption = { createdAt: -1 };
    if (sort === 'price_low') sortOption = { price: 1 };
    if (sort === 'price_high') sortOption = { price: -1 };
    if (sort === 'rating') sortOption = { rating: -1 };
    if (sort === 'name') sortOption = { title: 1 };

    const limitNum = Math.min(parseInt(limit) || 50, 200);
    const pageNum = parseInt(page) || 1;
    const skip = (pageNum - 1) * limitNum;

    const [spaces, total] = await Promise.all([
      Space.find(query)
        .populate('category', 'name icon color')
        .populate('owner', 'name email')
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum),
      Space.countDocuments(query)
    ]);

    res.json({ spaces, total, page: pageNum, limit: limitNum });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMySpaces = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const spaces = await Space.find({ owner: req.user._id })
      .populate('category', 'name icon')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Space.countDocuments({ owner: req.user._id });

    res.json({
      spaces,
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

exports.getSpaceById = async (req, res) => {
  try {
    const space = await Space.findById(req.params.id)
      .populate('category', 'name icon')
      .populate('owner', 'name email avatar hostApplicationStatus')
      .populate('reviews');

    if (!space) {
      return res.status(404).json({ message: 'Space not found' });
    }

    res.json(space);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createSpace = async (req, res) => {
  try {
    // Check if user is a verified host
    if (req.user.hostApplicationStatus !== 'verified') {
      return res.status(403).json({ 
        message: 'You must be a verified host to list properties. Please complete the host application process first.',
        requiresHostVerification: true
      });
    }

    const space = new Space({
      ...req.body,
      owner: req.user._id
    });
    
    await space.save();
    await space.populate('category', 'name icon');
    
    res.status(201).json({ message: 'Space created', space });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateSpace = async (req, res) => {
  try {
    const space = await Space.findById(req.params.id);

    if (!space) {
      return res.status(404).json({ message: 'Space not found' });
    }

    if (space.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this space' });
    }

    const updatedSpace = await Space.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    ).populate('category', 'name icon');

    res.json({ message: 'Space updated', space: updatedSpace });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteSpace = async (req, res) => {
  try {
    const space = await Space.findById(req.params.id);

    if (!space) {
      return res.status(404).json({ message: 'Space not found' });
    }

    if (space.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this space' });
    }
    await Booking.updateMany(
      { space: req.params.id },
      { 
        $set: { 
          space: null,
          propertyDeleted: true,
          propertyTitle: space.title,
          propertyLocation: space.location?.city || '',
          propertyHostId: space.owner
        }
      }
    );

    // Delete the property from listings
    await Space.findByIdAndDelete(req.params.id);

    res.json({ message: 'Space deleted (booking history preserved)' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getFeaturedSpaces = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const spaces = await Space.find({ isActive: true, featured: true })
      .populate('category', 'name icon color')
      .populate('owner', 'name email')
      .limit(limitNum)
      .sort({ rating: -1 });

    res.json(spaces);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSpacesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const spaces = await Space.find({ 
      category: categoryId, 
      isActive: true 
    })
      .populate('category', 'name icon')
      .populate('owner', 'name email hostApplicationStatus')
      .sort({ rating: -1 });

    res.json(spaces);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateBlockedDates = async (req, res) => {
  try {
    const space = await Space.findById(req.params.id);

    if (!space) {
      return res.status(404).json({ message: 'Space not found' });
    }

    if (space.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this space' });
    }

    const { blockedDates } = req.body;
    space.blockedDates = blockedDates;
    await space.save();

    res.json({ message: 'Blocked dates updated', blockedDates: space.blockedDates });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getBlockedDates = async (req, res) => {
  try {
    const space = await Space.findById(req.params.id);

    if (!space) {
      return res.status(404).json({ message: 'Space not found' });
    }

    const bookings = await Booking.find({
      space: req.params.id,
      status: { $in: ['requested', 'confirmed'] }
    }).select('date startTime endTime');

    const bookedDates = bookings.map(b => ({
      date: b.date,
      startTime: b.startTime,
      endTime: b.endTime
    }));

    // Filter out host blocked dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activeBlockedDates = (space.blockedDates || []).filter(block => {
      const endDate = new Date(block.endDate);
      return endDate >= today;
    });

    res.json({
      hostBlocked: activeBlockedDates,
      bookings: bookedDates
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
