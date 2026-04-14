const recommendationService = require('../services/recommendationService');
const Space = require('../models/Space');

exports.getContentBased = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const recommendations = await recommendationService.getContentBasedRecommendations(
      req.user._id,
      Number(limit)
    );
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getCollaborative = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const recommendations = await recommendationService.getCollaborativeRecommendations(
      req.user._id,
      Number(limit)
    );
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getHybrid = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const userId = req.user ? req.user._id : null;
    const recommendations = await recommendationService.getHybridRecommendations(
      userId,
      Number(limit)
    );
    res.json(recommendations);
  } catch (error) {
    console.error('Recommendation error:', error);
    // Fallback to active spaces on error
    const spaces = await Space.find({ isActive: true })
      .populate('category', 'name icon')
      .limit(Number(req.query.limit) || 10);
    res.json(spaces);
  }
};
