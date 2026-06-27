import * as nodemailer from 'nodemailer';

export const sendVerificationEmail = async (email: string, code: string): Promise<boolean> => {
  console.log(`[EMAIL MOCK] Verification code for ${email} is: ${code}`);

  // Try using real SMTP if credentials are configured in .env
  if (
    process.env.EMAIL_HOST &&
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASS &&
    process.env.EMAIL_USER !== 'your-email@gmail.com'
  ) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_PORT === '465',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

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
