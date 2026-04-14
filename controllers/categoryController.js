const Category = require('../models/Category');

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find({ 
      $or: [{ isActive: true }, { isActive: { $exists: false } }]
    }).sort({ name: 1 });
    res.json({ categories });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, icon, description, color } = req.body;
    
    const category = new Category({ name, icon, description, color });
    await category.save();
    
    res.status(201).json({ message: 'Category created', category });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, description, isActive, color } = req.body;
    
    const category = await Category.findByIdAndUpdate(
      id,
      { name, icon, description, isActive, color },
      { new: true }
    );
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json({ message: 'Category updated', category });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateManyCategories = async (req, res) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
      return res.status(400).json({ message: 'updates must be an array' });
    }
    
    for (const u of updates) {
      await Category.updateOne({ name: u.name }, { color: u.color });
    }
    
    const categories = await Category.find().sort({ name: 1 });
    res.json({ message: 'Categories updated', categories });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    const category = await Category.findByIdAndDelete(id);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
