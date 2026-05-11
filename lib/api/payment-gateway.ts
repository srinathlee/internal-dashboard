/**
 * Per-hospital payment gateway (Razorpay + WhatsApp payment links) settings.
 * Spec: docs/BACKEND_API_SPEC_HOSPITAL_CREATION.md §15.
 */

import { apiData } from "./client";

export interface PaymentGatewaySettings {
  razorpay_enabled: boolean;
  razorpay_key_id: string;
  /** Backend masks the secret on read. */
  razorpay_key_secret?: string;
  razorpay_webhook_url: string;
  razorpay_webhook_secret?: string;
  whatsapp_payment_links_enabled: boolean;
  whatsapp_provider_key?: string;
}

export function getPaymentGatewaySettings(
  hospitalId: string,
  signal?: AbortSignal,
): Promise<PaymentGatewaySettings> {
  return apiData<PaymentGatewaySettings>("/api/settings/payment-gateway", {
    query: { hospital_id: hospitalId },
    signal,
  });
}

export interface UpdatePaymentGatewayInput {
  hospital_id: string;
  razorpay_enabled?: boolean;
  razorpay_key_id?: string;
  /** Leave undefined to keep the existing secret. */
  razorpay_key_secret?: string;
  razorpay_webhook_url?: string;
  razorpay_webhook_secret?: string;
  whatsapp_payment_links_enabled?: boolean;
  whatsapp_provider_key?: string;
}

export function updatePaymentGatewaySettings(
  input: UpdatePaymentGatewayInput,
): Promise<PaymentGatewaySettings> {
  return apiData<PaymentGatewaySettings>("/api/settings/payment-gateway", {
    method: "PUT",
    body: input,
  });
}
