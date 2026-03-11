/**
 * emailStyles.ts — Unified email brand system for kWh Québec
 *
 * Single source of truth for ALL email templates.
 * Design baseline: Quick Analysis email (the best current template).
 *
 * Usage: import { brand, emailWrapper } from './emailStyles';
 */

import { getLogoDataUri } from './emailLogo';

// ─── Brand Constants ────────────────────────────────────────────────
export const brand = {
  // Colors
  primaryBlue: '#003DA6',
  darkBlue: '#002B75',
  accentYellow: '#FFB005',
  accentGreen: '#16A34A',
  accentAmber: '#f59e0b',
  textDark: '#333',
  textMuted: '#555',
  textLight: '#666',
  bgLight: '#f5f5f5',
  bgCard: '#f8f9fa',
  borderLight: '#e0e0e0',
  white: '#ffffff',

  // Typography (email-safe stack)
  fontStack: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",

  // Contact
  companyName: 'kWh Québec',
  taglineFr: 'Solaire + Stockage',
  taglineEn: 'Solar + Storage',
  phone: '514.427.8871',
  email: 'info@kwh.quebec',
  website: 'kwh.quebec',

  // Logo
  logoSizeLarge: '200px',  // client-facing emails
  logoSizeSmall: '140px',  // staff/system emails
} as const;

// ─── CTA Button ─────────────────────────────────────────────────────
export function ctaButton(text: string, href: string, style: 'primary' | 'secondary' = 'primary'): string {
  const bg = style === 'primary' ? brand.accentYellow : brand.primaryBlue;
  const color = style === 'primary' ? brand.darkBlue : brand.white;
  return `
    <div style="text-align:center;margin:30px 0;">
      <a href="${href}" style="display:inline-block;background:${bg};color:${color};padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;font-family:${brand.fontStack};">${text}</a>
    </div>`;
}

// ─── Highlight Box ──────────────────────────────────────────────────
export function highlightBox(content: string, borderColor: string = brand.accentYellow): string {
  return `
    <div style="background:#fffbeb;border-left:4px solid ${borderColor};padding:16px 20px;border-radius:0 6px 6px 0;margin:16px 0;font-size:14px;color:${brand.textMuted};line-height:1.6;">
      ${content}
    </div>`;
}

// ─── Info Row (for data tables) ─────────────────────────────────────
export function infoRow(label: string, value: string, highlight?: boolean): string {
  const borderColor = highlight ? brand.accentGreen : brand.primaryBlue;
  const bg = highlight ? '#f0fdf4' : brand.bgCard;
  return `
    <div style="background:${bg};padding:10px 14px;border-radius:6px;border-left:3px solid ${borderColor};margin-bottom:8px;">
      <div style="font-size:11px;color:${brand.textLight};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">${label}</div>
      <div style="font-size:14px;color:#1a1a1a;font-weight:500;">${value}</div>
    </div>`;
}

// ─── Section Title ──────────────────────────────────────────────────
export function sectionTitle(text: string): string {
  return `<div style="font-size:17px;font-weight:600;color:${brand.primaryBlue};margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid ${brand.accentYellow};">${text}</div>`;
}

// ─── Email Wrapper ──────────────────────────────────────────────────
// Unified HTML wrapper for ALL kWh emails.
export interface EmailWrapperOptions {
  lang: 'fr' | 'en';
  /** Main content HTML */
  body: string;
  /** Show logo in header? Default: true */
  showLogo?: boolean;
  /** Logo size: 'large' for client-facing, 'small' for staff/system */
  logoSize?: 'large' | 'small';
  /** Optional header title text (below logo) */
  headerTitle?: string;
  /** Optional badge text in header (e.g. "Action Required") */
  headerBadge?: string;
  /** Header badge color. Default: brand green */
  headerBadgeColor?: string;
  /** Show gradient header? Default: true */
  showHeader?: boolean;
  /** Optional disclaimer text above footer */
  disclaimer?: string;
  /** Show unsubscribe text? Default: false (only for nurture/marketing) */
  showUnsubscribe?: boolean;
  /** Footer note override */
  footerNote?: string;
}

export function emailWrapper(opts: EmailWrapperOptions): string {
  const {
    lang,
    body,
    showLogo = true,
    logoSize = 'large',
    headerTitle,
    headerBadge,
    headerBadgeColor = brand.accentGreen,
    showHeader = true,
    disclaimer,
    showUnsubscribe = false,
    footerNote,
  } = opts;

  const logoUrl = showLogo ? getLogoDataUri(lang) : '';
  const logoMaxWidth = logoSize === 'large' ? brand.logoSizeLarge : brand.logoSizeSmall;
  const tagline = lang === 'fr' ? brand.taglineFr : brand.taglineEn;

  // Header: white bg with logo, solid yellow bar, then blue title bar
  const logoHtml = showHeader && logoUrl ? `
    <div style="padding:28px 30px 20px;text-align:center;background:${brand.white};">
      <img src="${logoUrl}" alt="${brand.companyName} — ${tagline}" style="max-width:${logoMaxWidth};height:auto;" />
    </div>
    <div style="height:4px;background:${brand.accentYellow};"></div>` : '';

  const titleBarHtml = showHeader && headerTitle ? `
    <div style="background:${brand.primaryBlue};padding:16px 30px;text-align:center;">
      <h1 style="margin:0;font-size:20px;font-weight:600;color:${brand.white};font-family:${brand.fontStack};letter-spacing:0.3px;">${headerTitle}</h1>
      ${headerBadge ? `<span style="display:inline-block;background:${headerBadgeColor};color:${brand.white};padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;margin-top:10px;text-transform:uppercase;font-family:${brand.fontStack};">${headerBadge}</span>` : ''}
    </div>` : (showHeader && headerBadge ? `
    <div style="background:${brand.primaryBlue};padding:12px 30px;text-align:center;">
      <span style="display:inline-block;background:${headerBadgeColor};color:${brand.white};padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;font-family:${brand.fontStack};">${headerBadge}</span>
    </div>` : '');

  const headerHtml = logoHtml + titleBarHtml;

  const disclaimerHtml = disclaimer ? `
    <div style="font-size:12px;color:#888;padding:16px 30px;background:#fafafa;border-top:1px solid #eee;line-height:1.5;">
      ${disclaimer}
    </div>` : '';

  const unsubscribeHtml = showUnsubscribe ? `
    <div style="text-align:center;padding:8px;font-size:11px;color:#999;">
      ${lang === 'fr' ? 'Pour ne plus recevoir ces courriels, répondez avec "Désabonner".' : 'To unsubscribe from these emails, reply with "Unsubscribe".'}
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>${brand.companyName}</title>
</head>
<body style="margin:0;padding:0;font-family:${brand.fontStack};background-color:${brand.bgLight};-webkit-font-smoothing:antialiased;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:${brand.white};border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      ${headerHtml}
      <div style="padding:30px;font-family:${brand.fontStack};color:${brand.textDark};line-height:1.6;font-size:15px;">
        ${body}
      </div>
      ${disclaimerHtml}
      <div style="text-align:center;padding:18px 20px;color:${brand.textLight};font-size:12px;background:#f8f9fa;border-top:1px solid #e5e7eb;font-family:${brand.fontStack};">
        <strong style="color:${brand.primaryBlue};">${brand.companyName}</strong> &mdash; ${tagline}<br>
        <span style="color:${brand.textMuted};">${brand.phone}</span> &nbsp;|&nbsp; <a href="mailto:${brand.email}" style="color:${brand.primaryBlue};text-decoration:none;">${brand.email}</a>
        ${footerNote ? `<br><span style="font-size:11px;color:#aaa;margin-top:6px;display:inline-block;">${footerNote}</span>` : ''}
      </div>
      ${unsubscribeHtml}
    </div>
  </div>
</body>
</html>`;
}
