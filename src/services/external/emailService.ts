import sgMail from "@sendgrid/mail";
import { errorHandler } from "../../middleware/errorHandler";

// Initialize SendGrid with API Key
const initializeSendGrid = () => {
    if (!process.env.SMTP_PASS) {
        throw errorHandler(500, "SendGrid API Key is missing. Please check the SMTP_PASS environment variable.")
    }
    sgMail.setApiKey(process.env.SMTP_PASS)
}

initializeSendGrid();

// SendGrid requires a verified sender. We'll use SMTP_USER or FROM_EMAIL if available.
const fromEmail = process.env.SMTP_FROM ;



// Sends an email containing a One-Time Password to a user.
export const sendOTPEmail = async (email: string, otp: string, name: string = "User") => {
  if (!email || !otp) {
    throw errorHandler(400, "Email and OTP are required for sending OTP email");
  }

  try {
    const message = `Hello ${name}, your OTP code is ${otp}. It expires soon.`;

    const msg = {
      to: email,
      from: `SAVE PLAN <${fromEmail}>`,
      subject: "Your OTP Code",
      text: message,
      html: `<strong>${message}</strong>`, // SendGrid supports HTML
    };

    const [response] = await sgMail.send(msg)

    console.log(`OTP email sent successfully to ${email}:`, response.headers['x-message-id'])

    return { success: true, messageId: response.headers['x-message-id'] }

  } catch (error: any) {
    console.error("Error sending OTP email:", error);
    if (error.response) {
      console.error(error.response.body);
    }
    throw errorHandler(500, `Failed to send OTP email: ${error.message}`);
  }
};

// Sends an email with a password reset link to a user.
export const sendPasswordResetEmail = async (
  email: string,
  resetToken: string,
  name: string = "User"
) => {
  if (!email || !resetToken) {
    throw errorHandler(400, "Email and reset token are required for sending password reset email");
  }

  try {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;
    const message = `Hello ${name}, reset your password using: ${resetUrl}. This link expires soon.`;

    const msg = {
      to: email,
      from: `SAVE PLAN <${fromEmail}>`,
      subject: "Password Reset",
      text: message,
      html: `<p>Hello ${name},</p><p>Reset your password using: <a href="${resetUrl}">${resetUrl}</a></p><p>This link expires soon.</p>`,
    };

    const [response] = await sgMail.send(msg)

    console.log(`Reset password email sent successfully to ${email}:`, response.headers['x-message-id'])

    return { success: true, messageId: response.headers['x-message-id'] }

  } catch (error: any) {
    console.error("Error sending password reset email:", error);
    throw errorHandler(500, `Failed to send password reset email: ${error.message}`);
  }
};

// Sends a welcome email to a newly verified user.
export const sendWelcomeEmail = async (email: string, name: string) => {
  if (!email || !name) {
    throw errorHandler(400, "Email and name are required for sending welcome email");
  }

  try {
    const message = `Welcome ${name}! Your account has been verified successfully.`;

    const msg = {
      to: email,
      from: `SAVE PLAN <${fromEmail}>`,
      subject: "Welcome to Saveplan API",
      text: message,
      html: `<strong>${message}</strong>`,
    };

   const [response] = await sgMail.send(msg)

   console.log(`Welcome email sent successfully to ${email}:`, response.headers['x-message-id'])

   return { success: true, messageId: response.headers['x-message-id'] }
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    throw errorHandler(500, `Failed to send welcome email: ${error.message}`);
  }
};

// Sends a generic email message with a specified subject and content to a recipient.
export const sendGenericEmail = async (email: string, subject: string, message: string) => {
  if (!email || !subject || !message) {
    throw errorHandler(400, "Email, subject, and message are required for sending email");
  }

  try {
    const msg = {
      to: email,
      from: `"SAVEPLAN" <${fromEmail}>`,
      subject,
      text: message,
      html: `<p>${message}</p>`,
    };

   const [response] = await sgMail.send(msg)

   console.log(`email sent successfully to ${email}:`, response.headers['x-message-id'])

   return { success: true, messageId: response.headers['x-message-id'] }
  } catch (error: any) {
    console.error("Error sending email:", error);
    throw errorHandler(500, `Failed to send email: ${error.message}`);
  }
};
