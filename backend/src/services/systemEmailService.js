
const nodemailer = require('nodemailer');

class SystemEmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendInvite(email, fullName, inviteToken) {
    const inviteUrl = `${process.env.APP_URL}/accept-invite?token=${inviteToken}`;

    const mailOptions = {
      from: `"ANXORA" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'You have been invited to join ANXORA',
      html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 10px;">
                <h2 style="color: #4f46e5;">Welcome to ANXORA!</h2>
                <p>Hello ${fullName},</p>
                <p>An administrator has invited you to join their team on ANXORA.</p>
                <p>To get started and set your password, please click the button below:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${inviteUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Accept Invitation & Set Password</a>
                </div>
                <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #6b7280; font-size: 12px;">${inviteUrl}</p>
                <p>This invitation link will expire in 24 hours.</p>
                <hr style="border: 0; border-top: 1px solid #e1e1e1; margin: 20px 0;">
                <p style="font-size: 12px; color: #9ca3af;">If you didn't expect this invitation, you can safely ignore this email.</p>
            </div>
        `
    };

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('--- MOCK EMAIL START ---');
      console.log(`To: ${email}`);
      console.log(`URL: ${inviteUrl}`);
      console.log('--- MOCK EMAIL END ---');
      return { success: true, mocked: true };
    }

    return await this.transporter.sendMail(mailOptions);
  }
}

module.exports = new SystemEmailService();
