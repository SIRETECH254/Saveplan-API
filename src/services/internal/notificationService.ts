import { sendOTPEmail, sendWelcomeEmail, sendPasswordResetEmail } from "../external/emailService";
import { sendOTPSMS, sendWelcomeSMS, sendPasswordResetSMS } from "../external/smsService";

/**
 * High-level notification service that coordinates between Email and SMS channels.
 * It sends notifications based on availability of identifiers and credentials.
 */

export const sendOTPNotification = async (
  email: string,
  phone: string,
  otp: string,
  name: string
): Promise<any> => {
  const results: any = { email: null, sms: null };
  const messageName = name || "User";

  if (email) {
    try {
      results.email = await sendOTPEmail(email, otp, messageName);
    } catch (error: any) {
      results.email = { success: false, error: error.message };
    }
  }

  if (phone && process.env.AFRICAS_TALKING_API_KEY && process.env.AFRICAS_TALKING_USERNAME) {
    try {
      results.sms = await sendOTPSMS(phone, otp, messageName);
    } catch (error: any) {
      results.sms = { success: false, error: error.message };
    }
  } else if (phone) {
    results.sms = { skipped: true, reason: "SMS credentials not configured" };
  }

  return results;
};

export const sendWelcomeNotification = async (
  email: string,
  phone: string,
  name: string
): Promise<any> => {
  const results: any = { email: null, sms: null };
  const messageName = name || "User";

  if (email) {
    try {
      results.email = await sendWelcomeEmail(email, messageName);
    } catch (error: any) {
      results.email = { success: false, error: error.message };
    }
  }

  if (phone && process.env.AFRICAS_TALKING_API_KEY && process.env.AFRICAS_TALKING_USERNAME) {
    try {
      results.sms = await sendWelcomeSMS(phone, messageName);
    } catch (error: any) {
      results.sms = { success: false, error: error.message };
    }
  } else if (phone) {
    results.sms = { skipped: true, reason: "SMS credentials not configured" };
  }

  return results;
};

export const sendPasswordResetNotification = async (
  email: string,
  phone: string,
  token: string,
  name: string
): Promise<any> => {
  const results: any = { email: null, sms: null };
  const messageName = name || "User";

  if (email) {
    try {
      results.email = await sendPasswordResetEmail(email, token, messageName);
    } catch (error: any) {
      results.email = { success: false, error: error.message };
    }
  }

  if (phone && process.env.AFRICAS_TALKING_API_KEY && process.env.AFRICAS_TALKING_USERNAME) {
    try {
      results.sms = await sendPasswordResetSMS(phone, token, messageName);
    } catch (error: any) {
      results.sms = { success: false, error: error.message };
    }
  } else if (phone) {
    results.sms = { skipped: true, reason: "SMS credentials not configured" };
  }

  return results;
};
