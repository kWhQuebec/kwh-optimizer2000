/**
 * Design Agreement Configuration — kWh Québec
 * 
 * Single upfront payment: $2,500 CAD
 * - Creditable: deducted from the final project cost
 * - NOT a deposit — it's a professional services fee for:
 *   site visit, structural analysis, electrical assessment,
 *   detailed design, interconnection application (HQ)
 * - Non-refundable if client cancels
 * - If project proceeds, full $2,500 is credited on the EPC contract
 * 
 * Stripe integration: creates a Checkout Session for one-time payment
 */

import Stripe from 'stripe';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DesignAgreementConfig {
  /** Amount in cents (CAD) */
  amountCents: number;
  /** Display amount in dollars */
  amountDollars: number;
  /** Currency code */
  currency: 'cad';
  /** Stripe product name */
  productName: string;
  /** Description shown on checkout */
  description: string;
  /** Whether the amount is credited on the final EPC contract */
  creditableOnContract: boolean;
  /** Whether refundable if client cancels */
  refundable: boolean;
}

export const DESIGN_AGREEMENT: DesignAgreementConfig = {
  amountCents: 250_000, // $2,500.00 CAD
  amountDollars: 2_500,
  currency: 'cad',
  productName: 'Design Agreement — kWh Québec',
  description: 'Site visit, structural & electrical assessment, detailed solar design, HQ interconnection application. Creditable on final EPC contract.',
  creditableOnContract: true,
  refundable: false,
};

// ─── Stripe Helpers ──────────────────────────────────────────────────────────

const getStripe = (): Stripe => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(key, { apiVersion: '2024-04-10' });
};

/**
 * Creates a Stripe Checkout Session for a Design Agreement payment.
 * 
 * @param leadId - The lead/project ID in our system
 * @param clientEmail - Client's email for Stripe receipt
 * @param clientName - Client's company or personal name
 * @param successUrl - Redirect URL after successful payment
 * @param cancelUrl - Redirect URL if client cancels
 */
export async function createDesignAgreementCheckout(opts: {
  leadId: number;
  clientEmail: string;
  clientName: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();

  return stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: opts.clientEmail,
    client_reference_id: String(opts.leadId),
    line_items: [
      {
        price_data: {
          currency: DESIGN_AGREEMENT.currency,
          unit_amount: DESIGN_AGREEMENT.amountCents,
          product_data: {
            name: DESIGN_AGREEMENT.productName,
            description: DESIGN_AGREEMENT.description,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      leadId: String(opts.leadId),
      clientName: opts.clientName,
      type: 'design_agreement',
      creditableOnContract: 'true',
      amountCad: String(DESIGN_AGREEMENT.amountDollars),
    },
    payment_intent_data: {
      description: `Design Agreement — ${opts.clientName} (Lead #${opts.leadId})`,
      metadata: {
        leadId: String(opts.leadId),
        type: 'design_agreement',
      },
    },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  });
}

/**
 * Verifies a completed Design Agreement payment via webhook.
 * Returns payment details for recording in the database.
 */
export function extractPaymentDetails(session: Stripe.Checkout.Session) {
  return {
    leadId: Number(session.metadata?.leadId),
    clientName: session.metadata?.clientName ?? 'Unknown',
    amountPaid: (session.amount_total ?? 0) / 100,
    currency: session.currency?.toUpperCase() ?? 'CAD',
    stripeSessionId: session.id,
    stripePaymentIntentId: session.payment_intent as string,
    creditableOnContract: true,
    paidAt: new Date().toISOString(),
  };
}

/**
 * Constructs a Stripe webhook handler for Design Agreement events.
 * Usage: app.post('/api/stripe/webhook', express.raw({type: 'application/json'}), handleStripeWebhook)
 */
export function verifyStripeWebhook(
  payload: Buffer,
  signature: string
): Stripe.Event {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
