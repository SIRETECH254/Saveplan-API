import AfricasTalking from "africastalking";
import { errorHandler } from "../../middleware/errorHandler";

let africasTalking: any = null;
let sms: any = null;

if (
  process.env.AFRICAS_TALKING_API_KEY &&
  process.env.AFRICAS_TALKING_USERNAME &&
  process.env.AFRICAS_TALKING_API_KEY !== "your-africastalking-api-key" &&
  process.env.AFRICAS_TALKING_USERNAME !== "your-africastalking-username"
) {
  africasTalking = new (AfricasTalking as any)({
    apiKey: process.env.AFRICAS_TALKING_API_KEY,
    username: process.env.AFRICAS_TALKING_USERNAME
  });

  sms = africasTalking.SMS;
} else {
  console.warn("Africa's Talking SMS service not initialized: Invalid or missing credentials");
}

// Helper function to ensure phone numbers are in the correct international format (e.g., +2547XXXXXXXX).
const formatPhoneNumber = (phone: string): string => {
  let cleanNumber = phone.replace(/[\s\-\+]/g, "");

  if (cleanNumber.startsWith("0")) {
    cleanNumber = "254" + cleanNumber.substring(1);
  }

  if (!cleanNumber.startsWith("254")) {
    cleanNumber = "254" + cleanNumber;
  }

  return "+" + cleanNumber;
};

// Sends an SMS containing a One-Time Password to a user.
export const sendOTPSMS = async (phone: string, otp: string, name: string = "User") => {
  if (!phone || !otp) {
    throw errorHandler(400, "Phone number and OTP are required for sending SMS");
  }

  if (!sms) {
    throw errorHandler(500, "SMS service not initialized - check Africa's Talking credentials");
  }

  try {
    const formattedPhone = formatPhoneNumber(phone);
    const message = `Hello ${name}, your OTP code is ${otp}. It expires soon.`;

    const options: any = {
      to: [formattedPhone],
      message
    };

    if (process.env.SMS_SENDER_ID) {
      options.from = process.env.SMS_SENDER_ID;
    }

    const result = await sms.send(options);

    if (result?.SMSMessageData?.Recipients?.[0]?.status === "Success") {
      return {
        success: true,
        messageId: result.SMSMessageData.Recipients[0].messageId,
        cost: result.SMSMessageData.Recipients[0].cost
      };
    }

    return {
      success: false,
      error: result?.SMSMessageData?.Recipients?.[0]?.status || "Unknown SMS status"
    };
  } catch (error: any) {
    console.error("Error sending OTP SMS:", error);
    throw errorHandler(500, `Failed to send OTP SMS: ${error.message}`);
  }
};

// Sends an SMS with a password reset link to a user.
export const sendPasswordResetSMS = async (
  phone: string,
  resetToken: string,
  name: string = "User"
) => {
  if (!sms) {
    return { success: false, error: "SMS service not initialized" };
  }

  try {
    const formattedPhone = formatPhoneNumber(phone);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;
    const message = `Hello ${name}, reset your password using: ${resetUrl}. This link expires soon.`;

    const options: any = {
      to: [formattedPhone],
      message
    };

    if (process.env.SMS_SENDER_ID) {
      options.from = process.env.SMS_SENDER_ID;
    }

    const result = await sms.send(options);

    if (result?.SMSMessageData?.Recipients?.[0]?.status === "Success") {
      return {
        success: true,
        messageId: result.SMSMessageData.Recipients[0].messageId,
        cost: result.SMSMessageData.Recipients[0].cost
      };
    }

    return {
      success: false,
      error: result?.SMSMessageData?.Recipients?.[0]?.status || "Unknown SMS status"
    };
  } catch (error: any) {
    console.error("Error sending password reset SMS:", error);
    return { success: false, error: error.message };
  }
};

// Sends a welcome SMS to a newly verified user.
export const sendWelcomeSMS = async (phone: string, name: string) => {
  if (!sms) {
    return { success: false, error: "SMS service not initialized" };
  }

  try {
    const formattedPhone = formatPhoneNumber(phone);
    const message = `Welcome ${name}! Your account has been verified successfully.`;

    const options: any = {
      to: [formattedPhone],
      message
    };

    if (process.env.SMS_SENDER_ID) {
      options.from = process.env.SMS_SENDER_ID;
    }

    const result = await sms.send(options);

    if (result?.SMSMessageData?.Recipients?.[0]?.status === "Success") {
      return {
        success: true,
        messageId: result.SMSMessageData.Recipients[0].messageId,
        cost: result.SMSMessageData.Recipients[0].cost
      };
    }

    return {
      success: false,
      error: result?.SMSMessageData?.Recipients?.[0]?.status || "Unknown SMS status"
    };
  } catch (error: any) {
    console.error("Error sending welcome SMS:", error);
    return { success: false, error: error.message };
  }
};

// Sends a generic SMS message to a specified phone number.
export const sendGenericSMS = async (phone: string, message: string) => {
  if (!phone || !message) {
    throw errorHandler(400, "Phone number and message are required for sending SMS");
  }

  if (!sms) {
    throw errorHandler(500, "SMS service not initialized - check Africa's Talking credentials");
  }

  try {
    const formattedPhone = formatPhoneNumber(phone);
    const options: any = {
      to: [formattedPhone],
      message
    };

    if (process.env.SMS_SENDER_ID) {
      options.from = process.env.SMS_SENDER_ID;
    }

    const result = await sms.send(options);

    if (result?.SMSMessageData?.Recipients?.[0]?.status === "Success") {
      return {
        success: true,
        messageId: result.SMSMessageData.Recipients[0].messageId,
        cost: result.SMSMessageData.Recipients[0].cost
      };
    }

    return {
      success: false,
      error: result?.SMSMessageData?.Recipients?.[0]?.status || "Unknown SMS status"
    };
  } catch (error: any) {
    console.error("Error sending SMS:", error);
    throw errorHandler(500, `Failed to send SMS: ${error.message}`);
  }
};
