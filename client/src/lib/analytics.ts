/**
 * Google Analytics 4 tracking for kWh Québec
 *
 * Tracks key funnel conversion events:
 * - bill_uploaded: User uploads HQ bill
 * - bill_parsed: AI successfully parses bill data
 * - preview_shown: Partial results shown (value first)
 * - email_captured: User submits email (lead created)
 * - procuration_started: User clicks to start procuration
 * - procuration_signed: User completes e-signature
 * - report_opened: User opens their analysis report
 */

// GA4 measurement ID - set via environment variable
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';

// Initialize GA4 (loads gtag.js dynamically)
export function initGA4() {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined') return;

  // Don't double-load
  if (typeof window.gtag === 'function') return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: true,
  });
}

// Track custom events
export function trackEvent(eventName: string, params?: Record<string, string | number | boolean>) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params);
  }
}

// Funnel-specific tracking helpers
export const FunnelEvents = {
  billUploaded: (fileType: string) => trackEvent('bill_uploaded', { file_type: fileType }),
  billParsed: (consumption: number, confidence: number) => trackEvent('bill_parsed', { annual_kwh: consumption, confidence }),
  previewShown: (systemSizeKw: number, estimatedSavings: number) => trackEvent('preview_shown', { system_size_kw: systemSizeKw, estimated_savings: estimatedSavings }),
  emailCaptured: (source: string) => trackEvent('email_captured', { source }),
  procurationStarted: () => trackEvent('procuration_started'),
  procurationSigned: () => trackEvent('procuration_signed'),
  reportOpened: (format: string) => trackEvent('report_opened', { format }),
  ctaClicked: (ctaName: string, location: string) => trackEvent('cta_clicked', { cta_name: ctaName, location }),
  // Form interaction tracking
  formStarted: (formName: string) => trackEvent('form_started', { form_name: formName }),
  formFieldInteracted: (formName: string, fieldName: string) => trackEvent('form_field_interacted', { form_name: formName, field_name: fieldName }),
  formAbandoned: (formName: string, lastField: string, completedFields: number) => trackEvent('form_abandoned', { form_name: formName, last_field: lastField, completed_fields: completedFields }),
  formSubmitted: (formName: string, method: string) => trackEvent('form_submitted', { form_name: formName, method }),
  formError: (formName: string, errorType: string) => trackEvent('form_error', { form_name: formName, error_type: errorType }),
  // Page engagement
  scrollDepth: (depth: number, page: string) => trackEvent('scroll_depth', { depth_percent: depth, page }),
  timeOnPage: (seconds: number, page: string) => trackEvent('time_on_page', { seconds, page }),
  // Thank-you page
  thankYouViewed: (type: string) => trackEvent('thank_you_viewed', { type }),
};

// UTM parameter capture
export function captureUTMParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const utmParams: Record<string, string> = {};

  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  for (const key of utmKeys) {
    const value = params.get(key);
    if (value) utmParams[key] = value;
  }

  // Store in sessionStorage for later use (lead creation)
  if (Object.keys(utmParams).length > 0) {
    sessionStorage.setItem('kwhquebec_utm', JSON.stringify(utmParams));
  }

  return utmParams;
}

// Get stored UTM params (for attaching to API calls)
export function getStoredUTMParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = sessionStorage.getItem('kwhquebec_utm');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// TypeScript declarations for gtag
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}
