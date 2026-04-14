const axios = require('axios');
const Space = require('../models/Space');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You are a smart property search assistant for PosomePa. Your job is to parse natural language queries about property searches.

Given a user query, extract the following filters:
- location: city or area name (lowercase)
- maxPrice: maximum price per hour in rupees (if mentioned)
- minRating: minimum rating (if mentioned)
- category: type of property (if mentioned, e.g., "studio", "party hall", "apartment")
- amenities: list of required amenities (if mentioned)
- limit: number of results (default to 5)
- sortBy: how to sort results (options: "rating", "price_low", "price_high", "reviews")

Return ONLY a valid JSON object with these fields. Example:
Input: "top 5 cheap properties in mumbai with wifi"
Output: {"location": "mumbai", "maxPrice": 500, "limit": 5, "sortBy": "price_low", "amenities": ["wifi"]}

Input: "best rated studios in delhi"
Output: {"location": "delhi", "category": "studios", "sortBy": "rating", "limit": 5}

Input: "party halls under 1000"
Output: {"maxPrice": 1000, "category": "party", "sortBy": "rating", "limit": 5}

Return only the JSON, nothing else.`;

exports.smartSearch = async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || query.trim() === '') {
      return res.status(400).json({ message: 'Query is required' });
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    
    if (!groqApiKey || groqApiKey === 'gsk_your_groq_api_key_here') {
      return res.status(500).json({ 
        message: 'AI not configured. Please add GROQ_API_KEY to backend/.env file. Get free key at https://console.groq.com/keys'
      });
    }

    const response = await axios.post(
      GROQ_API_URL,
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: query }
        ],
        temperature: 0.1,
        max_tokens: 200
      },
      {
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiResponse = response.data.choices[0]?.message?.content;
    
    if (!aiResponse) {
      return res.status(500).json({ message: 'Failed to parse query with AI' });
    }

    // Parse AI response
    let filters;
    try {
      filters = JSON.parse(aiResponse.trim());
    } catch (parseError) {
      // Try to extract JSON from response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        filters = JSON.parse(jsonMatch[0]);
      } else {
        return res.status(500).json({ message: 'Failed to parse AI response' });
      }
    }

    // Build MongoDB query
    const mongoQuery = { isActive: true };

    if (filters.location) {
      mongoQuery['location.city'] = { $regex: new RegExp(filters.location, 'i') };
    }

    if (filters.category) {
      mongoQuery.category = { $regex: new RegExp(filters.category, 'i') };
    }

    if (filters.maxPrice) {
      mongoQuery.price = { $lte: filters.maxPrice };
    }

    if (filters.minRating) {
      mongoQuery.rating = { $gte: filters.minRating };
    }

    if (filters.amenities && filters.amenities.length > 0) {
      mongoQuery.amenities = { $all: filters.amenities };
    }

    // Determine sort
    let sortOption = { rating: -1 }; // Default: highest rated
    if (filters.sortBy === 'price_low') {
      sortOption = { price: 1 };
    } else if (filters.sortBy === 'price_high') {
      sortOption = { price: -1 };
    } else if (filters.sortBy === 'reviews') {
      sortOption = { reviewCount: -1 };
    }

    const limit = filters.limit || 5;

    const spaces = await Space.find(mongoQuery)
      .sort(sortOption)
      .limit(limit)
      .populate('category', 'name icon color');

    // Generate human-readable summary
    let summary = '';
    if (filters.location) {
      summary += `properties in ${filters.location.charAt(0).toUpperCase() + filters.location.slice(1)}`;
    } else {
      summary += 'all properties';
    }
    if (filters.category) {
      summary += ` (${filters.category})`;
    }
    if (filters.maxPrice) {
      summary += ` under ₹${filters.maxPrice}`;
    }
    if (filters.sortBy === 'rating') {
      summary = `Top rated ${summary}`;
    } else if (filters.sortBy === 'price_low') {
      summary = `Budget-friendly ${summary}`;
    }

    res.json({
      success: true,
      query: query,
      filters: filters,
      summary: `Found ${spaces.length} ${summary}`,
      spaces: spaces
    });

  } catch (error) {
    console.error('AI Search Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      return res.status(500).json({ 
        message: 'Invalid Groq API key. Please check your GROQ_API_KEY in .env file.'
      });
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND') {
      return res.status(500).json({ 
        message: 'Network error. Please check your internet connection.'
      });
    }

    res.status(500).json({ 
      message: error.response?.data?.error?.message || error.message || 'AI search failed. Please try again.' 
    });
  }
};

exports.getSuggestions = async (req, res) => {
  const suggestions = [
    "top 5 properties in delhi",
    "cheap party halls in mumbai",
    "best rated studios near me",
    "apartments under 500 rupees",
    "properties with wifi and parking",
    "cozy spaces for weekend",
    "quiet workspaces in bangalore",
    "luxury villas for events"
  ];
  
  res.json({ suggestions });
};
