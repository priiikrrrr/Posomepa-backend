const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODERATION_PROMPT = `You are a content moderator for PosomePa, a property rental platform in India. 

Analyze the following message and determine if it violates any of these rules:
1. Contains phone numbers in any format (spaced, dashed, spelled out, mixed with words, in Hindi/regional languages)
2. Contains email addresses or email service names
3. Contains social media references (instagram, whatsapp, telegram, snapchat, the green app etc)
4. Attempts to move conversation off-platform (book directly, call me, contact outside etc)
5. Contains off-platform payment requests (gpay, paytm, cash payment, bank transfer etc)
6. Contains sexual content, harassment, or inappropriate language
7. Contains hate speech, threats, or abusive language
8. Contains personal identifying information (address, Aadhaar, PAN etc)
9. Is spam, gibberish, or completely irrelevant to property rental
10. Attempts to bypass rules using Hindi, regional languages, or coded language

Respond ONLY with a JSON object in this exact format, nothing else:
{
  "allowed": true or false,
  "reason": "brief user-friendly reason if not allowed, empty string if allowed",
  "category": "contact_info|social_media|off_platform|payment|inappropriate|hate_speech|personal_info|spam|clean"
}`;

exports.moderateMessage = async (content) => {
  // Basic pattern check first (always runs, even if Groq fails)
  const basicPatterns = [
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, // emails
    /gmail|yahoo|hotmail|outlook|protonmail|icloud|rediff/i, // email services
    /\b\d{10}\b/, // 10 digit numbers
    /\+91\s?\d{10}/gi, // +91 numbers
    /\b9[78]\d{9}\b/, // mobile numbers
    /\b\d{5,}\b/, // long numbers
    /\d\s\d\s\d\s\d\s\d\s\d/, // spaced numbers
    /instagram|whatsapp|telegram|snapchat|facebook|twitter|linkedin/i,
    /\big\b(?!ore)/i, /\bwa\b(?!it)/i, /\bwp\b(?!ean)/i,
    /\btg\b/i, /\bsc\b/i, /\btt\b/i, /\bfb\b/i, /yt|youtube/i,
    /gpay|google\s?pay|paytm|phonepe|bhim|upi|neft|imps/i,
    /book\s?outside|book\s?directly|call\s?me|give\s?me\s?a\s?call/i,
  ];

  for (const pattern of basicPatterns) {
    if (pattern.test(content)) {
      return { allowed: false, reason: 'Message contains restricted content. Please remove contact info, social media, or payment references.', category: 'contact_info' };
    }
  }

  // Try Groq AI moderation
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: MODERATION_PROMPT },
        { role: 'user', content: `Message to moderate: "${content}"` }
      ],
      model: 'llama3-8b-8192',
      temperature: 0,
      max_tokens: 150,
      timeout: 10000, // 10 second timeout
      response_format: { type: 'json_object' }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      // Groq returned empty response - allow message but log it
      console.warn('Groq returned empty response, allowing message');
      return { allowed: true, reason: '', category: 'clean' };
    }

    return JSON.parse(response);
  } catch (error) {
    console.error('Moderation error (Groq failed):', error.message);
    // Groq failed - allow the message through with basic pattern check only
    // This prevents blocking legitimate messages due to API issues
    console.log('Groq moderation unavailable, using basic pattern check only');
    return { allowed: true, reason: '', category: 'clean', fallback: true };
  }
};
