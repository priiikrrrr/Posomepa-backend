// Twilio service - DISABLED (using Firebase OTP instead)
// const twilio = require('twilio');

// let twilioClient = null;

// const initTwilio = () => {
//   if (twilioClient) return twilioClient;
  
//   const accountSid = process.env.TWILIO_ACCOUNT_SID;
//   const authToken = process.env.TWILIO_AUTH_TOKEN;
  
//   if (!accountSid || !authToken) {
//     console.log('Twilio credentials not configured - SMS sending disabled');
//     return null;
//   }
  
//   try {
//     twilioClient = twilio(accountSid, authToken);
//     console.log('Twilio client initialized');
//     return twilioClient;
//   } catch (error) {
//     console.error('Failed to initialize Twilio:', error);
//     return null;
//   }
// };

// const sendSMS = async (to, message) => {
//   const client = initTwilio();
  
//   if (!client) {
//     console.log(`[DEV] SMS to ${to}: ${message}`);
//     return { success: true, dev: true };
//   }
  
//   try {
//     const from = process.env.TWILIO_PHONE_NUMBER;
    
//     if (!from) {
//       console.log('Twilio phone number not configured - SMS sending disabled');
//       console.log(`[DEV] SMS to ${to}: ${message}`);
//       return { success: true, dev: true };
//     }
    
//     const result = await client.messages.create({
//       body: message,
//       from: from,
//       to: to
//     });
    
//     console.log(`SMS sent to ${to}, SID: ${result.sid}`);
//     return { success: true, sid: result.sid };
//   } catch (error) {
//     console.error('Twilio SMS error:', error.message);
//     return { success: false, error: error.message };
//   }
// };

// const sendOTP = async (phone, otp) => {
//   const message = `Your PosomePa OTP is ${otp}. Valid for 5 minutes. Do not share this code.`;
//   return sendSMS(phone, message);
// };

// module.exports = {
//   initTwilio,
//   sendSMS,
//   sendOTP
// };

// Using Firebase OTP for phone verification instead
module.exports = {
  initTwilio: () => null,
  sendSMS: () => ({ success: true, dev: true }),
  sendOTP: () => ({ success: true, dev: true })
};
