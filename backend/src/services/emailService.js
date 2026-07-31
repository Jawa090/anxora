const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      if (!nodemailer || !nodemailer.createTransport) {
        console.error('❌ Nodemailer not properly loaded');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      console.log('✅ Email service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error.message);
    }
  }

  async sendPasswordResetEmail(email, resetToken, userName = '') {
    if (!this.transporter) {
      this.initializeTransporter();
    }
    if (!this.transporter) {
      throw new Error('Email service not initialized');
    }

    const resetLink = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: `"ANXORA" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Password Reset Request - ANXORA',
      html: this.getPasswordResetTemplate(resetLink, userName, email),
      text: `
Hello ${userName || 'User'},

You have requested to reset your password for your ANXORA account.

Please click the following link to reset your password:
${resetLink}

This link will expire in 1 hour for security reasons.

If you did not request this password reset, please ignore this email.

Best regards,
ANXORA Team
      `.trim()
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Password reset email sent to ${email}:`, info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`❌ Failed to send password reset email to ${email}:`, error.message);
      throw error;
    }
  }

  getPasswordResetTemplate(resetLink, userName, email) {
    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 10px;">
            <h2 style="color: #4f46e5;">Password Reset Request</h2>
            <p>Hello ${userName || 'User'},</p>
            <p>We received a request to reset the password for your ANXORA account associated with <strong>${email}</strong>.</p>
            <p>To reset your password, please click the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
            </div>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #6b7280; font-size: 12px;">${resetLink}</p>
            <p>This link will expire in 1 hour.</p>
            <hr style="border: 0; border-top: 1px solid #e1e1e1; margin: 20px 0;">
            <p style="font-size: 12px; color: #9ca3af;">If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
    `.trim();
  }

  async testConnection() {
    if (!this.transporter) {
      throw new Error('Email service not initialized');
    }

    try {
      await this.transporter.verify();
      console.log('✅ Email service connection verified');
      return true;
    } catch (error) {
      console.error('❌ Email service connection failed:', error.message);
      throw error;
    }
  }

  async verifyConnection() {
    return await this.testConnection();
  }

  async verifySMTP(config) {
    try {
      // Create a temporary transporter with the provided config
      const tempTransporter = nodemailer.createTransport({
        host: config.smtp_host,
        port: parseInt(config.smtp_port || 587),
        secure: config.smtp_port === 465,
        auth: {
          user: config.smtp_username || config.email_address,
          pass: config.encrypted_password,
        },
      });

      await tempTransporter.verify();
      return { verified: true };
    } catch (error) {
      console.error('SMTP verification failed:', error.message);
      return { verified: false, error: error.message };
    }
  }

  async sendEmail(options) {
    if (!this.transporter) {
      throw new Error('Email service not initialized');
    }

    try {
      const info = await this.transporter.sendMail(options);
      console.log(`✅ Email sent:`, info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`❌ Failed to send email:`, error.message);
      throw error;
    }
  }

  async sendCampaign(campaign, contacts) {
    const results = [];
    
    for (const contact of contacts) {
      try {
        await this.sendEmail({
          from: `"${campaign.from_name || 'Rush RMS'}" <${campaign.from_email || process.env.SMTP_USER}>`,
          to: contact.email,
          subject: campaign.subject,
          html: campaign.content,
        });
        
        results.push({ email: contact.email, success: true });
      } catch (error) {
        results.push({ email: contact.email, success: false, error: error.message });
      }
    }
    
    return results;
  }
}

module.exports = new EmailService();