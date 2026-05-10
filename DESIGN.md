# Color Match Live — Design

## Design Character

Warm editorial. Light, inviting, photography-forward. The tool is a means to an end; the user's output is the hero. The interface recedes; the card preview dominates. Not cold SaaS. Not dark. Not flashy.

## Color

**Surface palette** (Restrained):
- Background: `#ffffff`
- Content surface: `#fafafa` (zinc-50)
- Border: `#f4f4f5` (zinc-100)
- Border strong: `#e4e4e7` (zinc-200)
- Text primary: `#171717` (zinc-900)
- Text secondary: `#71717a` (zinc-500)
- Text muted: `#a1a1aa` (zinc-400)

**Semantic**:
- Primary action (upload): `#18181b` (zinc-900) — solid, confident
- Accent action (export): `#2563eb` (blue-600) → `#1d4ed8` (blue-700 on hover)
- Success: `#16a34a` (green-600)
- Error: `#dc2626` (red-600)
- Warning/info tint: `#eff6ff` (blue-50)

**Schemes** (user-generated, extracted from photo):
- `bg`: extracted dominant color
- `text`: contrast-adjusted foreground

## Typography

- **UI / Body**: Inter (variable via next/font), `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`
- **Preview headings / decorative text**:
  - Playfair Display (italic serif — editorial, cinematic)
  - Montserrat (clean geometric sans)
  - Cormorant Garamond (elegant old-style)
  - Lora (readable serif)
  - EB Garamond (classical)
- **Monospace**: For color hex values in input fields
- **Scale**: xs(12px), sm(14px), base(16px), lg(18px)
- **Line height**: 1.5 body, 1.2 headings
- **Chinese text**: System Chinese stack fallback

## Spacing

- Tailwind 4 spacing scale (gap-2=8px, gap-3=12px, gap-4=16px, gap-6=24px, gap-8=32px)
- Consistent 4px base unit
- Mobile padding: 16px horizontal
- Card padding: 16px (mobile), 16px (desktop)
- Section gaps: 12px within cards, 12px between cards

## Elevation

- **Cards**: `shadow-sm` (zinc-100 border instead of shadow)
- **Floating elements**: `shadow-lg` with blue tint (`shadow-blue-200`)
- **Preview shadow**: `shadow-2xl`
- Border-radius: `rounded-lg` (8px) for cards, `rounded-xl` (12px) for buttons/inputs, `rounded-full` for circles

## Motion

- **Color transitions**: `transition-all duration-300` (300ms) on preview background
- **Tab switches**: `transition-all` (no duration specified — default 150ms)
- **Processing state**: Spinner on RefreshCw icon
- No orchestrated load sequences
- No spring physics yet

## Component Inventory

### Upload button (cm-file / cm-upload-btn)
- Full-width, 12px radius, solid zinc-900 background, white text
- Font: 14px, weight 600
- Padding: 12px 16px
- States: default only (no hover/active/focus visual in CSS; React handles state)

### Color preset cards (scheme selectors)
- 78×78px square, 8px radius
- Inner swatch: full-width, square, `shadow-inner` background shows swatch color
- Label below: 12px, zinc-600, weight 500
- Selected: 2px zinc-900 border
- Hover: bg-zinc-50

### Tab bar (mobile)
- 3 tabs: 智能配色 / 自定义颜色 / 文字样式
- Pill shape container (bg-zinc-100, 6px radius, 2px padding)
- Active tab: white bg, shadow-sm, zinc-900 text
- Inactive: transparent bg, zinc-500 text

### Color pickers (custom color section)
- Color swatch: 52×52px, 10px radius, 2px zinc-300 border
- Eye-dropper button: same size, 2px border
- Text input: monospace, uppercase, 16px, zinc-900

### Export button
- Full-width on mobile (blue-600 → blue-700 on hover)
- Standalone on desktop (lg:flex), same styling
- Icon + label: Download + 导出成品

### Preview card
- Shadow-2xl, 12px radius
- Aspect ratio 3:4
- Color block: selectedScheme.bg
- Text overlay: selectedScheme.text, rotated 90° on portrait
- Image: object-cover, zinc-50 background

## Known Issues (impeccable audit targets)

1. Upload `cm-file` input relies on `::file-selector-button` — inconsistent across browsers, some mobile browsers show native picker differently
2. No CSS transition on the upload button
3. Mobile controls tab panels switch instantly with no animation
4. Color scheme card grid overflows horizontally without smooth scroll
5. No loading skeleton — spinner only in tab label, not replacing the card grid
6. Error states missing from export flow
7. Preview shadow on mobile is aggressive — `shadow-2xl` at 92vw is heavy
