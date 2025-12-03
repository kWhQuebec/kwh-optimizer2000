# Design Guidelines for kWh Québec Platform

## Design Approach

**Selected Approach:** Professional Design System  
**Rationale:** B2B solar analysis platform requiring trust, clarity, and efficiency for data-heavy workflows. Drawing inspiration from Linear's clean professionalism, Stripe's clarity, and Notion's content organization.

**Core Principles:**
1. Professional credibility and technical precision
2. Information clarity for complex data
3. Bilingual accessibility (FR-CA/EN-CA)
4. Efficiency-first for internal workflows

---

## Brand Identity

**Brand Colors:**
- Primary Blue: #003DA6 (HSL: 218, 100%, 33%) - Main brand color, sidebar background, buttons
- Accent Gold: #FFB005 (HSL: 41, 100%, 51%) - Highlights, CTAs, accent elements
- Neutral Gray: #AAAAAA - Secondary text, borders

**Logo Assets:**
- French: kWh_Quebec_Logo-01 (color on light background), solaire_fr (white on blue for sidebar)
- English: kWh_Quebec_Logo-02 (color on light background), solaire_en (white on blue for sidebar)
- Logo automatically switches based on user's language preference

---

## Typography System

**Font Families:**
- Primary: Montserrat (Google Fonts CDN) - Bold, modern, excellent for headings and brand presence
- Monospace: JetBrains Mono - For technical values, metrics, file names

**Hierarchy:**
- Display (Landing hero): text-5xl to text-6xl, font-bold
- H1 (Page titles): text-3xl, font-semibold
- H2 (Section headers): text-2xl, font-semibold
- H3 (Card headers): text-lg, font-medium
- Body: text-base, font-normal
- Small/Meta: text-sm, font-normal
- Tiny/Labels: text-xs, font-medium, uppercase tracking-wide

---

## Layout System

**Spacing Primitives:** Use Tailwind units of **2, 4, 6, 8, 12, 16, 20, 24**
- Component padding: p-4 to p-6
- Section spacing: py-12 to py-20
- Card gaps: gap-6 to gap-8
- Form fields: space-y-4

**Container Widths:**
- Public pages: max-w-7xl
- Dashboard: Full width with max-w-screen-2xl
- Content blocks: max-w-4xl
- Forms: max-w-lg

**Grid Patterns:**
- Dashboard cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Metrics: grid-cols-2 md:grid-cols-4
- Tables: Full width with horizontal scroll on mobile

---

## Component Library

### Navigation
- **Public Header:** Fixed top, logo left, navigation center, language toggle + CTA right
- **Dashboard Sidebar:** Fixed left (desktop), collapsible (mobile), grouped navigation items with icons
- **Breadcrumbs:** For multi-level navigation in dashboard

### Forms
- **Input Fields:** Full-width, rounded-lg, border-2, generous padding (px-4 py-3)
- **Labels:** Above inputs, text-sm font-medium, mb-2
- **Validation:** Inline error messages below fields, success states with checkmarks
- **Buttons:** Primary (solid), Secondary (outline), Ghost (text), sizes: sm, md, lg
- **Select Dropdowns:** Native select with custom arrow icon

### Data Display
- **Metric Cards:** Rounded-xl borders, p-6, label + large value + change indicator
- **Tables:** Striped rows, hover states, sticky headers, sortable columns
- **Charts:** Use Recharts - area charts for consumption trends, bar charts for comparisons, line charts for time series
- **Status Badges:** Rounded-full px-3 py-1 text-xs for file statuses (Uploaded/Parsed/Failed)

### Content Cards
- **Site Cards:** Hover elevation, rounded-lg, p-6, clear visual hierarchy
- **File Upload Zone:** Dashed border-2, rounded-lg, drag-drop area with icon + text
- **Analysis Results:** Large metric displays, grid layout, visual separators

### Modals & Overlays
- **Modals:** Centered overlay, max-w-2xl, rounded-xl, backdrop blur
- **Notifications:** Toast notifications top-right, slide-in animation
- **Loading States:** Skeleton screens for data-heavy sections, spinners for actions

---

## Public Landing Page Structure

### Hero Section (80vh)
- Left-aligned headline + subtext (60% width)
- Supporting visual or abstract graphic (40% width)
- Primary CTA button (blurred background overlay if on image)
- Trust indicators below: "Partenaire certifié Hydro-Québec" badges

### 3-Step Process (py-20)
- Three-column grid (stack mobile)
- Large numbered circles, icon, heading, description per step
- Visual connectors between steps (desktop only)

### Lead Form Section (py-24)
- Two-column: Form (60%) + Value prop/Benefits list (40%)
- Form in card with subtle elevation
- Progressive disclosure for optional fields
- Clear privacy statement

### Features Grid (py-20)
- 2x3 grid of feature cards
- Icon + heading + 2-3 line description per card

### Social Proof (py-16)
- Client logos in grid (if available)
- Or: Single compelling stat card centered

### Footer
- Multi-column: Company info, Services, Contact, Legal
- Newsletter signup inline
- Social links
- Language toggle

---

## Dashboard Layout

### Main Dashboard View
- Top bar: Page title, actions (Export, New Analysis), user menu
- 4-metric card row: Total Sites, Active Analyses, Total Savings, CO2 Avoided
- Recent activity table
- Quick actions grid

### Site Detail Page
- Header: Site name, address, client info, action buttons
- Tabs: Overview, Consumption Data, Analyses, Designs
- File upload section with drag-drop
- Files table with status indicators
- Analysis summary cards in grid

### Analysis Results View
- KPI metrics in prominent cards (2x3 grid)
- Full-width charts section: Consumption profile, Peak distribution, Savings projection
- Side-by-side comparison table (Before/After)
- Download PDF button (prominent, top-right)

### Design Module
- Component selector (dropdowns for modules, inverters, batteries)
- Live BOM table with inline editing
- Pricing summary sidebar (sticky)
- 3D system visualization placeholder area

---

## Images

**Public Landing Page:**
- **Hero:** Large supporting image (right side) showing modern solar installation on Québec commercial/industrial building, professional photography style
- **Process section:** Simple iconography, no photos
- **Features:** Icon-based, no photos needed
- **Optional:** Customer site photo in social proof section

**Dashboard:**
- Minimal imagery - focus on data visualization
- Empty states use simple illustrations
- Success states can use celebratory icons

---

## Accessibility & Bilingual Considerations

- All labels, placeholders, error messages fully translatable
- Language toggle visible and accessible
- Form inputs maintain consistent sizing regardless of language
- Metric abbreviations work in both languages (kWh, kW, $)
- Date formats: FR-CA (DD/MM/YYYY), EN-CA (MM/DD/YYYY)