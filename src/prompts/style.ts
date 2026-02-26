/**
 * Generates the Lead prompt for the style stage.
 * Single agent, no teammates — reads source CSS/style files and produces a style guide.
 */
export function generateStyleLeadPrompt(
  sourcePath: string,
  targetPath: string
): string {
  return `You are the Lead for a Proteus Forge style stage. Your job is to analyze the source POC's visual identity and produce a comprehensive style guide that downstream stages will use to preserve the UI aesthetics in production.

## Context

The source POC is at: ${sourcePath} (read-only reference)
You are working in: ${targetPath}

The inspection findings are at:
  ${targetPath}/.proteus-forge/01-inspect/features.json

## Instructions

### Step 1: Read Inspection Findings

Read ${targetPath}/.proteus-forge/01-inspect/features.json to understand:
- What frameworks and languages the POC uses
- Whether there is a frontend/UI component
- What styling technologies are in use (CSS, Tailwind, styled-components, etc.)

### Step 2: Scan Styling Files

Scan the source repository at ${sourcePath} for all styling-related files:
- CSS/SCSS/LESS files
- Tailwind config (tailwind.config.js/ts)
- Theme files, design token files
- Component library config (e.g., shadcn components.json)
- Global style files (globals.css, app.css, index.css)
- CSS-in-JS theme objects
- Font imports and icon library usage

If the POC has no frontend or styling files (e.g., a pure backend/CLI project), write a minimal style guide with \`"stylingTechnology": "none"\` and skip detailed extraction.

### Step 3: Extract Visual Identity

For POCs with a frontend, extract:

**Colors**: Find the color palette — primary, secondary, accent, background, surface, text, error colors. Look in CSS custom properties, Tailwind config, theme objects, or hardcoded values.

**Typography**: Identify font families (heading, body, monospace), font sizes/scale, line heights, and font weights. Check for Google Fonts imports or local font files.

**Spacing**: Identify the spacing system — base unit, scale values. Look in Tailwind config, CSS custom properties, or repeated values.

**Layout**: Identify layout strategy (flexbox, grid, hybrid), responsive breakpoints, and common layout patterns (sidebar-main, top-nav-content, card-grid, etc.).

**Component Patterns**: Identify recurring UI components (buttons, cards, modals, forms, navigation) and their visual variants.

**Screen Layouts**: Walk each route/page in the app. For each screen (and significant modals/dialogs), document:
- The overall layout structure (which regions exist and where)
- What components live in each region and their arrangement
- Relative sizing and positioning of regions
- Source files that implement the screen

To discover screens: walk the router/page structure (e.g., React Router routes, Next.js pages/app directory, Vue Router). For each screen, read the JSX/HTML to identify layout regions and component placement. Document modals/dialogs as separate screens with \`type: "modal"\` and note what triggers them. If the POC has no frontend, set \`"screens": []\`.

**Design Tokens**: Check if the POC uses a formal design token system (CSS custom properties, Tailwind config, theme objects).

**Dark Mode**: Check if dark mode is supported and how it's implemented.

### Step 4: Write Outputs

Create the directory ${targetPath}/.proteus-forge/02-style/ and write two files:

**${targetPath}/.proteus-forge/02-style/style-guide.json** — Machine-readable style guide:
\`\`\`json
{
  "forgeVersion": "1.0.0",
  "stage": "style",
  "generatedAt": "<ISO timestamp>",
  "source": {
    "stylingTechnology": "tailwind|css-modules|styled-components|scss|css|none",
    "componentLibrary": "shadcn|mui|ant-design|none|...",
    "iconSet": "lucide|heroicons|...|none"
  },
  "colorPalette": {
    "primary": { "value": "#...", "usage": "..." },
    "secondary": { "value": "#...", "usage": "..." },
    "accent": { "value": "#...", "usage": "..." },
    "background": { "value": "#...", "usage": "..." },
    "surface": { "value": "#...", "usage": "..." },
    "text": { "value": "#...", "usage": "..." },
    "error": { "value": "#...", "usage": "..." },
    "custom": [ { "name": "...", "value": "#...", "usage": "..." } ]
  },
  "typography": {
    "fontFamilies": [ { "name": "...", "role": "heading|body|mono", "source": "google-fonts|local|system" } ],
    "scale": [ { "name": "xs|sm|base|lg|xl|2xl|...", "size": "...", "lineHeight": "...", "weight": "..." } ]
  },
  "spacing": {
    "unit": "rem|px|...",
    "scale": [ "0.25rem", "0.5rem", "..." ]
  },
  "layout": {
    "strategy": "flexbox|grid|hybrid",
    "responsive": { "breakpoints": { "sm": "...", "md": "...", "lg": "..." } },
    "patterns": [ { "name": "sidebar-main|top-nav-content|card-grid|...", "description": "...", "sourceFiles": [] } ]
  },
  "componentPatterns": [
    {
      "name": "button|card|modal|form|nav|...",
      "variants": [ "primary", "secondary", "ghost" ],
      "description": "...",
      "sourceFiles": []
    }
  ],
  "designTokens": {
    "hasTokenFile": true,
    "tokenFilePath": "...",
    "format": "css-custom-properties|tailwind-config|theme-object|..."
  },
  "screens": [
    {
      "name": "Dashboard",
      "route": "/dashboard",
      "type": "page|modal|drawer|panel",
      "description": "Brief description of the screen's purpose",
      "layout": "sidebar-main|top-nav-content|single-column|...",
      "regions": [
        {
          "name": "sidebar",
          "position": "left|right|top|bottom|center|overlay",
          "sizing": "w-64|flex-1|...",
          "components": [
            {
              "type": "nav|card-grid|form|table|header|button-group|...",
              "description": "What this component shows and how it's arranged",
              "details": {}
            }
          ]
        }
      ],
      "sourceFiles": ["src/pages/Dashboard.tsx"]
    }
  ],
  "darkMode": {
    "supported": false,
    "strategy": "class-toggle|media-query|css-variables|none"
  },
  "summary": "1-2 sentence overview of the POC's visual identity"
}
\`\`\`

**${targetPath}/.proteus-forge/02-style/style.md** — Human-readable style guide:
\`\`\`markdown
# Style Guide — <project name>

**Generated:** <date>
**Styling Technology:** <technology>

---

## Visual Overview
[1-2 paragraph summary of the POC's visual identity and design language]

## Styling Technology
[What CSS framework/approach the POC uses, component libraries, icon sets]

## Color Palette
[Document each color with its hex value, usage context, and where it appears in the source]

## Typography
[Font families, sizes, weights, line heights — the complete type scale]

## Layout System
[Layout strategy, responsive breakpoints, common layout patterns with descriptions]

## Component Patterns
[Recurring UI components, their variants, and visual characteristics]

## Screen Layouts
[For each screen/route: describe the layout regions, what components live where,
 and how the screen is spatially composed. Include modals and drawers.]

## Design Tokens
[Whether formal tokens exist, their format, and key token values]

## Recommendations for Production
[Suggestions for preserving or improving the visual identity in production:
- Which styling approach to keep vs migrate
- Any inconsistencies to resolve
- Missing tokens or patterns to formalize]
\`\`\`

## Important

- The source at ${sourcePath} is READ-ONLY. Never modify it.
- Read features.json FIRST to understand the project context.
- If the POC has no frontend/styling (pure backend, CLI, library), write a minimal style-guide.json with \`"stylingTechnology": "none"\` and a brief style.md noting this is a non-UI project. Do NOT fail.
- Extract actual values (hex codes, font names, pixel/rem sizes) — not just descriptions.
- Create the directory ${targetPath}/.proteus-forge/02-style/ before writing.
`;
}
