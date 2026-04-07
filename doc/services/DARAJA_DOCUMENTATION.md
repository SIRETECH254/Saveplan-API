# 💰 Saveplan API - Daraja (M-Pesa) Documentation

## 📋 Table of Contents
- [Daraja Overview](#daraja-overview)
- [Configuration](#configuration)
- [External Services](#external-services)
- [Internal Services](#internal-services)
- [Usage in Controllers](#usage-in-controllers)
- [Callbacks and Webhooks](#callbacks-and-webhooks)
- [Error Handling](#error-handling)
- [API Examples](#api-examples)

---

## Daraja Overview

Daraja is the API gateway for M-Pesa, a mobile money transfer service in Kenya. In this project, the Daraja API is integrated to facilitate M-Pesa payments for member contributions, specifically using the STK Push (Sim Tool Kit Push) functionality. This allows members to confirm payments directly from their mobile phones.

**Key Features:**
-   **STK Push Initiation:** Programmatically trigger M-Pesa STK Push prompts on user phones.
-   **Transaction Callbacks:** Receive real-time notifications for payment success or failure.
-   **Transaction Status Query:** Check the status of an STK Push transaction.
-   **Secure Authentication:** Uses OAuth 2.0 for API access.

---

## Configuration

Daraja API credentials and settings are managed through environment variables. These are consumed by `src/services/external/darajaService.ts` to authenticate with Safaricom and handle transaction callbacks.

**Environment Variables:**
-   `MPESA_ENV`: `sandbox` or `production`. Determines the base URL for Daraja API.
-   `MPESA_CONSUMER_KEY`: Your M-Pesa app consumer key.
-   `MPESA_CONSUMER_SECRET`: Your M-Pesa app consumer secret.
-   `MPESA_SHORT_CODE`: The M-Pesa Pay Bill or Buy Goods short code.
-   `MPESA_PASSKEY`: The M-Pesa STK Push Passkey.
-   `CALLBACK_URL`: The base URL of your API server used to construct the webhook endpoint (`/api/payments/webhooks/mpesa`).

---

## External Services

The `src/services/external/darajaService.ts` file provides the core functions for direct interaction with the Safaricom Daraja API.

**`initiateStkPush`**
Handles the STK Push request payload and communication with Safaricom.

```typescript
export const initiateStkPush = async (params: { amount: number, phone: string, accountReference: string }): Promise<any> => {
  // ... OAuth and build payload
  const payload = {
    BusinessShortCode: Number(shortCode),
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.round(params.amount),
    PartyA: normalizedPhone,
    PartyB: Number(shortCode),
    PhoneNumber: normalizedPhone,
    CallBackURL: `${process.env.CALLBACK_URL}/api/payments/webhooks/mpesa`,
    AccountReference: params.accountReference,
    TransactionDesc: "Contribution Payment"
  };

  const resp = await axios.post(`${base}/mpesa/stkpush/v1/processrequest`, payload, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  return {
    merchantRequestId: resp.data?.MerchantRequestID,
    checkoutRequestId: resp.data?.CheckoutRequestID,
    raw: resp.data
  };
};
```

**`parseCallback`**
Extracts transaction results and metadata from Daraja webhooks.

```typescript
export const parseCallback = (body: any) => {
  const stk = body?.Body?.stkCallback || {};
  const success = String(stk.ResultCode) === "0";
  const checkoutRequestId = stk.CheckoutRequestID;
  const items = stk?.CallbackMetadata?.Item || [];

  let amount, phone, transactionRef;
  for (const item of items) {
    if (item?.Name === "Amount") amount = item?.Value;
    if (item?.Name === "PhoneNumber") phone = item?.Value;
    if (item?.Name === "MpesaReceiptNumber") transactionRef = item?.Value;
  }

  return { valid: !!stk, success, checkoutRequestId, amount, phone, transactionRef, raw: body };
};
```

**`queryStkPushStatus`**
Checks the current status of an STK Push transaction using its `checkoutRequestId`.

```typescript
export const queryStkPushStatus = async (checkoutRequestId: string): Promise<any> => {
  // ... OAuth and build payload
  const resp = await axios.post(`${base}/mpesa/stkpushquery/v1/query`, {
    BusinessShortCode: Number(shortCode),
    Password: password,
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestId
  }, { headers: { Authorization: `Bearer ${accessToken}` } });

  return { ok: true, resultCode: resp.data?.ResultCode, resultDesc: resp.data?.ResultDesc, raw: resp.data };
};
```

---

## Internal Services

The internal payment service (`src/services/internal/paymentService.ts`) orchestrates M-Pesa payments within the application's business logic.

**`initiateMpesaPayment`**
Initiates payment for a contribution and links the transaction to the payment record.

```typescript
export const initiateMpesaPayment = async (params: { payment: IPayment, phone: string, accountReference: string }): Promise<any> => {
  const { payment, phone, accountReference } = params;
  const res = await initiateStkPush({ amount: payment.amount, phone, accountReference });

  payment.processorRefs.daraja = {
    merchantRequestId: res.merchantRequestId,
    checkoutRequestId: res.checkoutRequestId
  };
  await payment.save();

  return res;
};
```

**`applySuccessfulPayment`**
Processes a successful payment, updating the payment status and completing the related contribution record.

```typescript
export const applySuccessfulPayment = async (payment: IPayment, io?: any): Promise<void> => {
  payment.status = "SUCCESS";
  await payment.save();

  if (payment.contributionId) {
    const contribution = await Contribution.findById(payment.contributionId);
    if (contribution) {
      contribution.status = "COMPLETED";
      contribution.paymentId = payment.paymentNumber;
      contribution.transactionDate = new Date();
      await contribution.save();
      
      if (io) io.emit("contribution.updated", { contributionId: contribution._id, status: "COMPLETED" });
    }
  }

  if (io) io.emit("payment.updated", { paymentId: payment._id, status: "SUCCESS" });
};
```

---

## Usage in Controllers

The payment controller (`src/controllers/paymentController.ts`) handles M-Pesa webhooks and status checks.

**File: `src/controllers/paymentController.ts` - Snippets**

```typescript
import { parseCallback, queryStkPushStatus } from "../services/external/darajaService";

// ... inside mpesaWebhook function
const parsed = parseCallback(payload);

// ... inside checkPaymentStatus function
const statusResult = await queryStkPushStatus(checkoutRequestId);
```

---

## Callbacks and Webhooks

The Daraja API relies on callbacks (webhooks) to notify the application of transaction outcomes. The `mpesaWebhook` controller function is configured as the endpoint for STK Push transactions.

All webhook processing is logged for debugging.

---

## Error Handling

Daraja service functions use `try-catch` blocks with custom error reporting. API failures include raw error details when available.

---

## API Examples

**Initiate M-Pesa Payment**

```bash
curl -X POST http://localhost:2500/api/payments/initiate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "amount": 1000, "phone": "2547XXXXXXXX", "contributionId": "<contributionId>" }'
```

**Check M-Pesa STK Push Status**

```bash
curl -X GET http://localhost:2500/api/payments/status/<checkoutRequestId> \
  -H "Authorization: Bearer <token>"
```

---

**Last Updated:** April 2026
**Version:** 1.0.0
**Maintainer:** Saveplan API Development Team
