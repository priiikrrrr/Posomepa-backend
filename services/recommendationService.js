const Space = require('../models/Space');
const Booking = require('../models/Booking');
const Category = require('../models/Category');
const User = require('../models/User');

const AMENITIES_LIST = [
  'wifi', 'parking', 'ac', 'power_backup', 'water',
  'security', 'cctv', 'lift', 'toilet', 'kitchen',
  'furniture', 'projector', 'whiteboard', 'printer', 'phone'
];

const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Goa', 'Jaipur', 'Rishikesh', 'Pune', 'Kolkata'];

async function getFeatureVector(space) {
  try {
    if (!space || !space._id) {
      return new Array(9 + AMENITIES_LIST.length + 1 + CITIES.length + 3).fill(0);
    }
    
    const category = await Category.findById(space.category).catch(() => null);
    const categoryIndex = category ? ['Apartments', 'Office Spaces', 'Event Halls', 'Gyms', 'Studios', 'Guest Houses', 'Private Properties', 'Parking Spaces', 'Ashrams'].indexOf(category.name) : 0;
  
    const categoryVector = new Array(9).fill(0);
    if (categoryIndex >= 0) categoryVector[categoryIndex] = 1;

    const amenitiesVector = AMENITIES_LIST.map(a => 
      space.amenities?.includes(a) ? 1 : 0
    );

    const maxPrice = 10000;
    const priceNormalized = Math.min(space.price / maxPrice, 1);

    const cityIndex = CITIES.indexOf(space.location?.city || '');
    const cityVector = new Array(CITIES.length).fill(0);
    if (cityIndex >= 0) cityVector[cityIndex] = 1;

    const priceTypeVector = [0, 0, 0];
    if (space.priceType === 'hourly') priceTypeVector[0] = 1;
    else if (space.priceType === 'daily') priceTypeVector[1] = 1;
    else if (space.priceType === 'monthly') priceTypeVector[2] = 1;

    return [
      ...categoryVector,
      ...amenitiesVector,
      priceNormalized,
      ...cityVector,
      ...priceTypeVector
    ];
  } catch (error) {
    console.error('Error in getFeatureVector:', error);
    return new Array(9 + AMENITIES_LIST.length + 1 + CITIES.length + 3).fill(0);
  }
}

function cosineSimilarity(vec1, vec2) {
  if (vec1.length !== vec2.length) return 0;
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  
  if (norm1 === 0 || norm2 === 0) return 0;
  
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

exports.getContentBasedRecommendations = async (userId, limit = 10) => {
  try {
    const bookings = await Booking.find({ 
      user: userId, 
      status: { $in: ['confirmed', 'completed'] } 
    }).populate('space');

    if (bookings.length === 0) {
      const featuredSpaces = await Space.find({ isActive: true, featured: true })
        .populate('category', 'name icon')
        .limit(limit);
      return featuredSpaces;
    }
    const validBookings = bookings.filter(b => b.space && b.space._id);
    if (validBookings.length === 0) {
      const featuredSpaces = await Space.find({ isActive: true, featured: true })
        .populate('category', 'name icon')
        .limit(limit);
      return featuredSpaces;
    }

    const bookedSpaceIds = validBookings.map(b => b.space._id.toString());
    const userProfile = new Array(9 + AMENITIES_LIST.length + 1 + CITIES.length + 3).fill(0);
    const vectorLength = 9 + AMENITIES_LIST.length + 1 + CITIES.length + 3;

    for (const booking of validBookings) {
      const featureVector = await getFeatureVector(booking.space);
      for (let i = 0; i < Math.min(featureVector.length, vectorLength); i++) {
        userProfile[i] += featureVector[i];
      }
    }

    const weight = 1 / validBookings.length;
    for (let i = 0; i < userProfile.length; i++) {
      userProfile[i] *= weight;
    }

    const allSpaces = await Space.find({ 
      isActive: true,
      _id: { $nin: bookedSpaceIds }
    }).populate('category', 'name icon');

    const spaceSimilarities = [];

    for (const space of allSpaces) {
      const spaceVector = await getFeatureVector(space);
      const similarity = cosineSimilarity(userProfile, spaceVector);
      
      if (similarity > 0) {
        spaceSimilarities.push({ space, similarity });
      }
    }

    spaceSimilarities.sort((a, b) => b.similarity - a.similarity);

    return spaceSimilarities.slice(0, limit).map(s => s.space);
  } catch (error) {
    console.error('Content-based recommendation error:', error);
    return [];
  }
};

exports.getCollaborativeRecommendations = async (userId, limit = 10) => {
  try {
    const userBookings = await Booking.find({ 
      user: userId, 
      status: { $in: ['confirmed', 'completed'] }
    });

    if (userBookings.length === 0) {
      return await Space.find({ isActive: true })
        .populate('category', 'name icon')
        .limit(limit);
    }

    // Filter out deleted bookings (where space is null)
    const validBookings = userBookings.filter(b => b.space);
    if (validBookings.length === 0) {
      return await Space.find({ isActive: true })
        .populate('category', 'name icon')
        .limit(limit);
    }

    const userSpaceIds = validBookings.map(b => b.space.toString());

    const similarUsers = await Booking.aggregate([
      {
        $match: {
          space: { $in: userSpaceIds },
          user: { $ne: userId },
          status: { $in: ['confirmed', 'completed'] }
        }
      },
      {
        $group: {
          _id: '$user',
          commonSpaces: { $push: '$space' }
        }
      },
      {
        $addFields: {
          commonCount: { $size: '$commonSpaces' }
        }
      },
      { $sort: { commonCount: -1 } },
      { $limit: 10 }
    ]);

    if (similarUsers.length === 0) {
      return await Space.find({ isActive: true })
        .populate('category', 'name icon')
        .limit(limit);
    }

    const similarUserIds = similarUsers.map(u => u._id);

    const recommendedSpaces = await Booking.aggregate([
      {
        $match: {
          user: { $in: similarUserIds },
          space: { $nin: userSpaceIds },
          status: { $in: ['confirmed', 'completed'] }
        }
      },
      {
        $group: {
          _id: '$space',
          bookingCount: { $sum: 1 }
        }
      },
      { $sort: { bookingCount: -1 } },
      { $limit: limit }
    ]);

    const spaceIds = recommendedSpaces.map(s => s._id);
    const spaces = await Space.find({ _id: { $in: spaceIds }, isActive: true })
      .populate('category', 'name icon');

    const spaceMap = new Map(spaces.map(s => [s._id.toString(), s]));
    return spaceIds.map(id => spaceMap.get(id.toString())).filter(Boolean);
  } catch (error) {
    console.error('Collaborative recommendation error:', error);
    return [];
  }
};

exports.getHybridRecommendations = async (userId, limit = 10) => {
  try {
    if (!userId) {
      // For guests - return most booked spaces (trending)
      const trendingSpaces = await Booking.aggregate([
        { $match: { status: { $in: ['confirmed', 'completed'] } } },
        { $group: { _id: '$space', bookingCount: { $sum: 1 } } },
        { $sort: { bookingCount: -1 } },
        { $limit: limit },
        { $lookup: { from: 'spaces', localField: '_id', foreignField: '_id', as: 'space' } },
        { $unwind: '$space' },
        { $replaceRoot: { newRoot: '$space' } },
        { $match: { isActive: true } }
      ]).catch(() => []);

      if (trendingSpaces.length > 0) {
        await Space.populate(trendingSpaces, { path: 'category', select: 'name icon' });
        return trendingSpaces;
      }

      // Fallback to recent active spaces
      const spaces = await Space.find({ isActive: true })
        .populate('category', 'name icon')
        .sort({ createdAt: -1 })
        .limit(limit);
      return spaces;
    }
    
    const [contentBased, collaborative] = await Promise.all([
      this.getContentBasedRecommendations(userId, limit * 2),
      this.getCollaborativeRecommendations(userId, limit * 2)
    ]);

    const spaceMap = new Map();
    
    contentBased.forEach((space, index) => {
      spaceMap.set(space._id.toString(), {
        space,
        score: (contentBased.length - index) * 0.4
      });
    });

    collaborative.forEach((space, index) => {
      const existing = spaceMap.get(space._id.toString());
      if (existing) {
        existing.score += (collaborative.length - index) * 0.6;
      } else {
        spaceMap.set(space._id.toString(), {
          space,
          score: (collaborative.length - index) * 0.6
        });
      }
    });

    const sorted = Array.from(spaceMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return sorted.map(s => s.space);
  } catch (error) {
    console.error('Hybrid recommendation error:', error);
    return [];
  }
};
