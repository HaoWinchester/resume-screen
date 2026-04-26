---
name: Professional HR Management
colors:
  surface: '#fbf8ff'
  surface-dim: '#dad9e3'
  surface-bright: '#fbf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f2fc'
  surface-container: '#eeedf7'
  surface-container-high: '#e8e7f1'
  surface-container-highest: '#e3e1eb'
  on-surface: '#1a1b22'
  on-surface-variant: '#444653'
  inverse-surface: '#2f3037'
  inverse-on-surface: '#f1f0fa'
  outline: '#757684'
  outline-variant: '#c4c5d5'
  surface-tint: '#3755c3'
  primary: '#00288e'
  on-primary: '#ffffff'
  primary-container: '#1e40af'
  on-primary-container: '#a8b8ff'
  inverse-primary: '#b8c4ff'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#611e00'
  on-tertiary: '#ffffff'
  tertiary-container: '#872d00'
  on-tertiary-container: '#ffa583'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b8c4ff'
  on-primary-fixed: '#001453'
  on-primary-fixed-variant: '#173bab'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdbce'
  tertiary-fixed-dim: '#ffb59a'
  on-tertiary-fixed: '#380d00'
  on-tertiary-fixed-variant: '#802a00'
  background: '#fbf8ff'
  on-background: '#1a1b22'
  surface-variant: '#e3e1eb'
typography:
  h1:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  h2:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  h3:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0em
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  data-tabular:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.2'
    letterSpacing: 0em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 24px
  container-max: 1440px
---

## Brand & Style

The visual identity of the design system is anchored in trust, reliability, and administrative efficiency. It adopts a **Corporate / Modern** design style, prioritizing high legibility and a systematic approach to complex data management. 

The aesthetic is characterized by a "density-conscious" layout that balances the need for significant information display with the psychological need for breathing room. By utilizing a restrained color palette and precise geometry, the design system minimizes cognitive load for HR professionals handling sensitive employee data and complex workflows. The overall feel is authoritative yet accessible, ensuring users feel in control of the platform's power.

## Colors

The color strategy for the design system is built on a foundation of professional trust. The **Primary Blue (#1E40AF)** is used for high-level brand moments, primary actions, and active states to signify stability. The **Success Green (#10B981)** is utilized purposefully for positive status indicators, completion states, and "Hire" or "Approve" workflows.

Neutral tones lean toward a cool Slate palette to maintain a clean, clinical feel that avoids the "muddy" look of warmer grays. Semantic colors for errors and warnings are strictly reserved for critical feedback to ensure they command immediate attention within data-dense environments.

## Typography

This design system utilizes **Inter** exclusively to leverage its exceptional readability on digital screens and its systematic, neutral character. The type scale is optimized for high-density information environments.

Headlines use tighter letter spacing and heavier weights to provide clear section anchors. For data-heavy contexts, such as employee lists and payroll tables, the system prioritizes 14px text for the best balance of scanning speed and information density. All labels for form headers use a semi-bold weight to distinguish metadata from user input.

## Layout & Spacing

The design system employs a **Fixed Grid** philosophy for centralized content areas to ensure predictable scanning patterns, while utilizing fluid widths for dashboard-style analytics views. 

The layout is governed by an 8px spatial grid. This modular rhythm ensures that every element, from the smallest icon padding to the largest container margin, feels intentional and aligned. Large sections of whitespace (40px+) are used between major content groups to prevent the interface from feeling "cramped," which is a common failure point in HR software. Consistent 24px gutters are maintained between cards and table columns to ensure data remains distinct and legible.

## Elevation & Depth

To maintain a clean and professional look, the design system avoids heavy shadows. Instead, it uses **Ambient Shadows** and **Tonal Layers** to establish hierarchy:

1.  **Level 0 (Base):** Background surfaces use a subtle off-white (#F8FAFC) to reduce eye strain.
2.  **Level 1 (Surface):** Cards and primary content containers are pure white with a very soft, diffused shadow (0px 1px 3px rgba(0,0,0,0.1)) to lift them slightly from the background.
3.  **Level 2 (Interaction):** Hover states and dropdown menus use a slightly more pronounced shadow to indicate temporary "float" over the UI.
4.  **Borders:** Subtle 1px borders in a light gray-blue are used to define table cells and form fields, ensuring structure even when shadows are minimal.

## Shapes

The design system uses a consistent **Rounded (8px)** corner radius for all primary containers, buttons, and input fields. This moderate rounding softens the corporate edge of the system without making it feel overly casual or "playful."

Large components like dashboard cards and modal containers may use a 16px (rounded-lg) radius to emphasize their role as structural anchors. Status badges and tags utilize a fully rounded "pill" shape to distinguish them clearly from interactive buttons and input fields.

## Components

### Data Tables
Tables are the heart of this design system. They feature a minimal header with a subtle background tint and 1px bottom borders. Row hovering is essential for tracking data horizontally. Typography within tables is kept at 14px for maximum density without sacrificing legibility.

### Form Elements
Inputs use an 8px radius with a 1px border. The focus state transitions the border to the Primary Blue with a subtle 2px glow. Labels are positioned above the field in a semi-bold weight.

### Status Badges
Status indicators (e.g., "Active," "On Leave," "Pending") use a soft background fill derived from the semantic color at 10% opacity, paired with high-contrast text in the same hue. They are pill-shaped to stand out within data rows.

### Upload Areas
The upload component features a dashed border in a neutral gray with a large icon centered. Upon dragging a file over, the area transitions to a light Primary Blue background to signal the drop zone is active.

### Cards
Cards are the primary layout tool. They must have a consistent 24px internal padding and should be used to group related employee information or specific HR metrics. Hierarchy within cards is established through bold sub-headers and primary-colored icons.