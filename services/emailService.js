const sgMail = require('@sendgrid/mail');
require('dotenv').config();

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@posomepa.com';
const FROM_NAME = 'PosomePa';

const emailService = {
  // Send approval email to host applicant
  sendApprovalEmail: async (toEmail, applicantName) => {
    try {
      const msg = {
        to: toEmail,
        from: {
          email: FROM_EMAIL,
          name: FROM_NAME
        },
        subject: 'Congratulations! Your PosomePa Host Application is Approved 🎉',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #8B5CF6, #7C3AED); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; background: #8B5CF6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>🎉 Congratulations, ${applicantName}!</h1>
            </div>
            <div class="content">
              <p>Your application for becoming a host at <strong>PosomePa</strong> has been approved!</p>
              <p>We look forward to seeing you thrive and have an amazing experience with us.</p>
              <p><strong>What's next?</strong></p>
              <ul>
                <li>📱 Download the PosomePa app</li>
                <li>🏠 Start listing your space</li>
                <li>💰 Start earning from your property</li>
              </ul>
              <p>Welcome aboard!</p>
            </div>
            <div class="footer">
              <p>© 2024 PosomePa. All rights reserved.</p>
            </div>
          </body>
          </html>
        `,
        text: `
Dear ${applicantName},

Congratulations! Your application for becoming a host at PosomePa has been approved!

We look forward to seeing you thrive and have an amazing experience with us.

What's next?
- Download the PosomePa app
- Start listing your space
- Start earning from your property

Welcome aboard!

© 2024 PosomePa. All rights reserved.
        `
      };

      await sgMail.send(msg);
      console.log('Approval email sent to:', toEmail);
      return { success: true };
    } catch (error) {
      console.error('SendGrid Error:', error.response?.body || error.message);
      return { success: false, error: error.message };
    }
  },

  // Send rejection email to host applicant
  sendRejectionEmail: async (toEmail, applicantName, reason) => {
    try {
      const msg = {
        to: toEmail,
        from: {
          email: FROM_EMAIL,
          name: FROM_NAME
        },
        subject: 'Update on Your PosomePa Host Application',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #6B7280; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
              .reason-box { background: #FEE2E2; border-left: 4px solid #DC2626; padding: 15px; margin: 20px 0; }
              .button { display: inline-block; background: #8B5CF6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Application Update</h1>
            </div>
            <div class="content">
              <p>Dear ${applicantName},</p>
              <p>We are sad to say that we have rejected your application for becoming a host on <strong>PosomePa</strong>.</p>
              
              <div class="reason-box">
                <strong>Reason:</strong>
                <p>${reason}</p>
              </div>
              
              <p>But hey, chin up! You can always apply again after 14 hours.</p>
              <p>We appreciate your interest in joining PosomePa.</p>
            </div>
            <div class="footer">
              <p>© 2024 PosomePa. All rights reserved.</p>
            </div>
          </body>
          </html>
        `,
        text: `
Dear ${applicantName},

We are sad to say that we have rejected your application for becoming a host on PosomePa.

Reason: ${reason}

But hey, chin up! You can always apply again after 14 hours.

We appreciate your interest in joining PosomePa.

© 2024 PosomePa. All rights reserved.
        `
      };

      await sgMail.send(msg);
      console.log('Rejection email sent to:', toEmail);
      return { success: true };
    } catch (error) {
      console.error('SendGrid Error:', error.response?.body || error.message);
      return { success: false, error: error.message };
    }
  },

  // Check if SendGrid is configured
  isConfigured: () => {
    return !!process.env.SENDGRID_API_KEY;
  }
};

module.exports = emailService;
