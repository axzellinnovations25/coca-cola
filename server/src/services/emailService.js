const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendGreetingEmail({ to, firstName, email, password }) {
  const mailOptions = {
    from: process.env.SMTP_FROM,
    to,
    subject: 'Welcome to S.B Distribution!',
    html: `<p>Dear ${firstName},</p>
      <p>Your account has been created. Please find your login credentials below:</p>
      <ul>
        <li><b>Username (Email):</b> ${email}</li>
        <li><b>Password:</b> ${password}</li>
      </ul>
      <p>You can change your password after logging in.</p>
      <p>Best regards,<br/>S.B Distribution Team</p>`
  };
  await transporter.sendMail(mailOptions);
}

async function sendPasswordResetEmail({ to, firstName, resetToken }) {
  // Use environment variable for frontend URL, fallback to the correct domain
  const frontendUrl = process.env.FRONTEND_URL || 
    (process.env.NODE_ENV === 'production' 
      ? 'https://sbdistribution.store'  // The actual Netlify domain with custom domain
      : 'http://localhost:3000');
  
  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
  
  const mailOptions = {
    from: process.env.SMTP_FROM,
    to,
    subject: 'Password Reset Request - S.B Distribution',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg,rgb(142, 10, 214) 0%,rgb(113, 16, 211) 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px; color: white;">S.B Distribution</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9; color: gray;">Password Reset Request</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
          <p style="color: #333; font-size: 16px; margin-bottom: 20px;">Dear ${firstName},</p>
          
          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            We received a request to reset your password for your S.B Distribution account. 
            If you didn't make this request, you can safely ignore this email.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background: linear-gradient(135deg, rgb(113, 16, 211) 0%, rgb(113, 16, 211) 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 25px; 
                      display: inline-block; 
                      font-weight: bold;
                      font-size: 16px;">
              Reset Your Password
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
            <strong>Important:</strong> This link will expire in 15 minutes for security reasons.
          </p>
          
          <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
            If the button above doesn't work, you can copy and paste this link into your browser:
          </p>
          
          <p style="color: #007bff; font-size: 14px; word-break: break-all; background: #f1f3f4; padding: 10px; border-radius: 5px;">
            ${resetUrl}
          </p>
          
          <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
          
          <p style="color: #666; font-size: 12px; text-align: center;">
            This is an automated message, please do not reply to this email.<br>
            If you have any questions, please contact your system administrator.
          </p>
        </div>
      </div>
    `
  };
  
  await transporter.sendMail(mailOptions);
}

module.exports = {
  sendGreetingEmail,
  sendPasswordResetEmail,
}; 