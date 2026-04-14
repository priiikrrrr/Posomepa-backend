const Review = require('../models/Review');
const Space = require('../models/Space');

exports.addReview = async (req, res) => {
  try {
    const { spaceId, rating, comment } = req.body;
    
    const space = await Space.findById(spaceId);
    if (!space) {
      return res.status(404).json({ message: 'Space not found' });
    }

    const existingReview = await Review.findOne({ space: spaceId, user: req.user._id });
    if (existingReview) {
      existingReview.rating = rating;
      existingReview.comment = comment || '';
      await existingReview.save();
      
      const reviews = await Review.find({ space: spaceId });
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      space.rating = Math.round(avgRating * 10) / 10;
      space.reviewCount = reviews.length;
      await space.save();
      
      return res.json({ message: 'Review updated', review: existingReview, spaceRating: space.rating });
    }

    const review = new Review({
      space: spaceId,
      user: req.user._id,
      rating,
      comment: comment || ''
    });
    await review.save();

    const reviews = await Review.find({ space: spaceId });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    space.rating = Math.round(avgRating * 10) / 10;
    space.reviewCount = reviews.length;
    await space.save();

    res.status(201).json({ message: 'Review added', review, spaceRating: space.rating });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'You have already reviewed this space' });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.getSpaceReviews = async (req, res) => {
  try {
    const { spaceId } = req.params;
    
    const reviews = await Review.find({ space: spaceId })
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own reviews' });
    }

    await review.deleteOne();

    const space = await Space.findById(review.space);
    const reviews = await Review.find({ space: review.space });
    
    if (reviews.length > 0) {
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      space.rating = Math.round(avgRating * 10) / 10;
    } else {
      space.rating = 0;
    }
    space.reviewCount = reviews.length;
    await space.save();

    res.json({ message: 'Review deleted', spaceRating: space.rating });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
