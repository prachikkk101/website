import * as nodemailer from 'nodemailer';

const createTransporter = () => {
  if (
    process.env.EMAIL_HOST &&
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASS &&
    process.env.EMAIL_USER !== 'your-email@gmail.com'
  ) {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_PORT === '465',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return null;
};

export const sendVerificationEmail = async (email: string, code: string): Promise<boolean> => {
  console.log(`[EMAIL MOCK] Verification code for ${email} is: ${code}`);

  const transporter = createTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"GP-PMS System" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'GP-PMS Email Verification Code',
        text: `Your email verification OTP code is: ${code}. It expires in 15 minutes.`,
        html: `<p>Your email verification OTP code is: <strong>${code}</strong>.</p><p>It expires in 15 minutes.</p>`,
      });
      return true;
    } catch (err) {
      console.error('Failed to send real email, falling back to mock. Error:', err);
    }
  }

  return true;
};

export const sendPasswordResetOTP = async (email: string, otp: string): Promise<boolean> => {
  console.log(`[EMAIL MOCK] Password reset OTP for ${email} is: ${otp}`);

  const transporter = createTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"GP-PMS System" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'GP-PMS Admin Password Reset OTP',
        text: `Someone requested a password reset for your GP-PMS admin account. Your OTP is: ${otp}. It expires in 15 minutes. If this wasn't you, ignore this email and your password will remain unchanged.`,
        html: `
          <p>Someone requested a password reset for your <strong>GP-PMS admin account</strong>.</p>
          <p>Your OTP is: <strong style="font-size:24px;letter-spacing:4px;">${otp}</strong></p>
          <p>It expires in <strong>15 minutes</strong>.</p>
          <p style="color:#888;">If this wasn't you, ignore this email and your password will remain unchanged.</p>
        `,
      });
      return true;
    } catch (err) {
      console.error('Failed to send password reset OTP email, falling back to mock. Error:', err);
    }
  }

  return true;
};

export const sendPasswordChangedNotification = async (email: string): Promise<boolean> => {
  console.log(`[EMAIL MOCK] Password changed notification sent to ${email}`);

  const transporter = createTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"GP-PMS System" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'GP-PMS Admin Password Changed',
        text: `Your GP-PMS password was just changed. If this wasn't you, contact the other admin immediately.`,
        html: `
          <p>Your <strong>GP-PMS password</strong> was just changed.</p>
          <p style="color:#dc2626;font-weight:bold;">If this wasn't you, contact the other admin immediately.</p>
        `,
      });
      return true;
    } catch (err) {
      console.error('Failed to send password changed notification email, falling back to mock. Error:', err);
    }
  }

  return true;
};

