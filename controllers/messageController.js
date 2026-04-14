const Message = require('../models/Message');
const Space = require('../models/Space');
const User = require('../models/User');
const { moderateMessage } = require('../services/moderationService');

const THREAD_CLOSE_MINUTES = 1440;

const validateMessage = (content) => {
  if (!content || content.trim().length === 0) {
    return { valid: false, reason: 'Message cannot be empty' };
  }
  if (content.length > 200) {
    return { valid: false, reason: 'Message must be 200 characters or less' };
  }

  const OBVIOUS_PATTERNS = [
    { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, reason: 'Contact information not allowed' },
    { regex: /gmail|yahoo|hotmail|outlook|protonmail|icloud|rediff/i, reason: 'Email service names not allowed' },
    { regex: /\b\d{10}\b/, reason: 'Phone numbers not allowed' },
    { regex: /\+91\s?\d{10}/gi, reason: 'Phone numbers not allowed' },
    { regex: /\b9[78]\d{9}\b/, reason: 'Phone numbers not allowed' },
    { regex: /\b\d{5,}\b/, reason: 'Sharing long numbers is not allowed' },
    { regex: /\d\s\d\s\d\s\d\s\d\s\d/, reason: 'Phone numbers not allowed' },
  ];

  const SOCIAL_MEDIA_PATTERNS = [
    /instagram|insta|whatsapp|telegram|snapchat|facebook|twitter|linkedin/i,
    /\big\b(?!ore)/i,  // ig (not "ignore")
    /\bwa\b(?!it)/i,   // wa (not "wait")
    /\bwp\b(?!ean)/i,  // wp (not "open")
    /\btg\b/i,         // tg
    /\bsc\b/i,         // snapchat
    /\btt\b/i,         // tiktok
    /\bfb\b/i,         // facebook
    /\bx\b(?:\s|$|,)/i,  // twitter/x
    /yt|youtube/i,
    /dm\s?me|message\s?me|contact\s?me|reach\s?me|find\s?me/i,
  ];

  const PAYMENT_PATTERNS = [
    /gpay|google\s?pay|paytm|phonepe|bhim|upi|neft|imps/i,
    /cash\s?on|pay\s?cash|direct\s?pay|pay\s?outside|pay\s?offline/i,
    /account\s?number|bank\s?transfer|send\s?money/i,
  ];

  const PLATFORM_BYPASS_PATTERNS = [
    /book\s?outside|book\s?directly|direct\s?booking/i,
    /call\s?me|give\s?me\s?a\s?call|ring\s?me/i,
    /my\s?number|my\s?contact|my\s?details/i,
    /off\s?platform|outside\s?app|bypass/i,
  ];

  for (const check of OBVIOUS_PATTERNS) {
    if (check.regex.global) check.regex.lastIndex = 0;
    if (check.regex.test(content)) {
      return { valid: false, reason: check.reason };
    }
  }

  for (const pattern of SOCIAL_MEDIA_PATTERNS) {
    if (pattern.test(content)) {
      return { valid: false, reason: 'Social media references not allowed' };
    }
  }

  for (const pattern of PAYMENT_PATTERNS) {
    if (pattern.test(content)) {
      return { valid: false, reason: 'Off-platform payment requests not allowed' };
    }
  }

  for (const pattern of PLATFORM_BYPASS_PATTERNS) {
    if (pattern.test(content)) {
      return { valid: false, reason: 'Please keep all communication within PosomePa' };
    }
  }

  return { valid: true };
};

const isThreadClosed = (message) => {
  if (!message.closedAt) return false;
  return new Date() > new Date(message.closedAt);
};

const canHostReply = (message) => {
  if (isThreadClosed(message)) return false;
  if (message.replies.length === 0) return true;
  
  let consecutiveHostReplies = 0;
  for (let i = message.replies.length - 1; i >= 0; i--) {
    if (message.replies[i].sender.toString() === message.receiver.toString()) {
      consecutiveHostReplies++;
    } else {
      break;
    }
  }
  
  return consecutiveHostReplies < 2;
};

exports.sendMessage = async (req, res) => {
  try {
    const { propertyId, content } = req.body;
    const senderId = req.user.id;

    if (!propertyId || !content) {
      return res.status(400).json({ message: 'Property ID and message content are required' });
    }

    const basicCheck = validateMessage(content);
    if (!basicCheck.valid) {
      return res.status(400).json({ message: basicCheck.reason });
    }

    const moderation = await moderateMessage(content);
    if (!moderation.allowed) {
      try {
        const FlaggedMessage = require('../models/FlaggedMessage');
        await FlaggedMessage.create({
          content,
          userId: senderId,
          propertyId,
          category: moderation.category,
          reason: moderation.reason
        });
      } catch (e) {
        console.error('Failed to log flagged message:', e);
      }

      return res.status(400).json({ 
        message: moderation.reason || 'Message contains restricted content',
        category: moderation.category
      });
    }

    const property = await Space.findById(propertyId).populate('owner');
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    if (property.owner._id.toString() === senderId) {
      return res.status(400).json({ message: 'Cannot message yourself' });
    }

    // Count ALL threads ever created by this user for this property
    const threadCount = await Message.countDocuments({
      sender: senderId,
      property: propertyId
    });

    if (threadCount >= 2) {
      return res.status(400).json({ 
        message: 'You have reached the maximum of 2 conversations allowed for this property',
        limitReached: true
      });
    }

    // Check if there's an open thread
    const existingThread = await Message.findOne({
      sender: senderId,
      property: propertyId,
      deletedBySender: false
    });

    if (existingThread && !isThreadClosed(existingThread)) {
      return res.status(400).json({ 
        message: 'You already have an open thread for this property',
        existingThreadId: existingThread._id,
        closed: false
      });
    }

    const message = new Message({
      sender: senderId,
      receiver: property.owner._id,
      property: propertyId,
      content: content.trim(),
      closedAt: new Date(Date.now() + THREAD_CLOSE_MINUTES * 60 * 1000)
    });

    await message.save();
    await message.populate('sender', 'name email phone');
    await message.populate('property', 'title images');

    res.status(201).json({ 
      message: 'Message sent successfully', 
      data: message,
      threadsUsed: threadCount + 1,
      threadsRemaining: 2 - (threadCount + 1)
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
};

exports.getMyMessages = async (req, res) => {
  try {
    const userId = req.user.id;

    // Only return messages SENT by this user (as a user booking someone's property)
    const messages = await Message.find({
      sender: userId,
      deletedBySender: false
    })
    .populate('sender', 'name email phone')
    .populate('receiver', 'name email phone')
    .populate('property', 'title images location.city')
    .sort({ updatedAt: -1 });

    // Add thread count per property
    const messagesWithCount = await Promise.all(messages.map(async (msg) => {
      const count = await Message.countDocuments({
        sender: userId,
        property: msg.property?._id
      });
      return {
        ...msg.toObject(),
        threadsUsed: count,
        threadsRemaining: Math.max(0, 2 - count)
      };
    }));

    res.json({ messages: messagesWithCount });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
};

exports.getHostMessages = async (req, res) => {
  try {
    const hostId = req.user.id;

    const messages = await Message.find({
      receiver: hostId,
      deletedByReceiver: false
    })
    .populate('sender', 'name email phone')
    .populate('property', 'title images location.city')
    .sort({ updatedAt: -1 });

    const unreadCount = messages.filter(m => !m.read).length;

    res.json({ messages, unreadCount });
  } catch (error) {
    console.error('Get host messages error:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const message = await Message.findOne({
      _id: id,
      receiver: userId
    });

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    message.read = true;
    await message.save();

    res.json({ message: 'Marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ message: 'Failed to update message' });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await Message.updateMany(
      { receiver: userId, read: false },
      { read: true }
    );

    res.json({ message: 'All messages marked as read' });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ message: 'Failed to update messages' });
  }
};

exports.replyToMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const hostId = req.user.id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Reply cannot be empty' });
    }

    if (content.length > 200) {
      return res.status(400).json({ message: 'Reply must be 200 characters or less' });
    }

    const basicCheck = validateMessage(content);
    if (!basicCheck.valid) {
      return res.status(400).json({ message: basicCheck.reason });
    }

    const moderation = await moderateMessage(content);
    if (!moderation.allowed) {
      return res.status(400).json({ 
        message: moderation.reason || 'Reply contains restricted content'
      });
    }

    const message = await Message.findOne({
      _id: id,
      receiver: hostId
    });

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (!canHostReply(message)) {
      return res.status(400).json({ message: 'Please wait for the user to send another message before replying' });
    }

    message.replies.push({
      sender: hostId,
      content: content.trim()
    });

    await message.save();
    await message.populate('replies.sender', 'name');

    res.status(201).json({ message: 'Reply sent', data: message });
  } catch (error) {
    console.error('Reply error:', error);
    res.status(500).json({ message: 'Failed to send reply' });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const message = await Message.findOne({
      _id: id,
      $or: [
        { sender: userId },
        { receiver: userId }
      ]
    });

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.sender.toString() === userId) {
      message.deletedBySender = true;
    } else {
      message.deletedByReceiver = true;
    }

    const bothDeleted = message.deletedBySender && message.deletedByReceiver;
    if (bothDeleted) {
      await Message.deleteOne({ _id: id });
    } else {
      await message.save();
    }

    res.json({ message: 'Message deleted' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ message: 'Failed to delete message' });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const count = await Message.countDocuments({
      receiver: userId,
      read: false,
      deletedByReceiver: false
    });

    res.json({ unreadCount: count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Failed to get unread count' });
  }
};
