## Overview
Apply the defined Dune visual identity consistently across all existing UI elements (HUD, menus, chat, mission tracker, etc.). Implement core accessibility features (text size, colorblind filters, key remapping). Ensure UI is responsive and performs well. *(UI components likely reside in `client/src/components/` or a dedicated `client/src/ui/` directory, styles in `client/src/style.css` or dedicated files)*.

## Dune Visual Identity Guidelines

### Typography System
- Implement clear, readable typography
  - Primary font: Chakra Petch or similar sans-serif with subtle angular qualities for headers
  - Secondary font: Open Sans or Roboto for body text with excellent readability
  - Set hierarchical type scale (16px base with 1.2 ratio)
  - Maintain minimum contrast ratio of 4.5:1 for all text
- Create consistent text styling
  - Headers: 24-32px, medium/bold weight
  - Body text: 16-18px, regular weight with 140% line height
  - UI labels: 14-16px, medium weight
  - Tooltips: 14px with 130% line height

### Color Palette
- Create desert-inspired color scheme
  - Primary: Deep blue (#1A3A6E) inspired by stillsuits and night desert
  - Secondary: Spice orange (#D9730D) for interactive elements and highlights
  - Background: Sand beige (#E5DED1) for panels and containers
  - Alert: Rust red (#9C3122) for warnings and critical information
- Implement UI state colors
  - Interactive: Slightly lighter variation of primary/secondary (+10% brightness)
  - Hover: Subtle glow effect with 2px soft highlight
  - Active/Selected: 20% brighter than base state
  - Disabled: 40% opacity reduction with desaturation
- Create dark/light mode variations (Optional Stretch Goal)
  - Dark mode: Deeper blues and darker sand tones for night gameplay
  - Light mode: Higher contrast options for daytime desert environments

### Visual Design Elements
- Implement geometric interface elements
  - Container shapes with subtle 30° angular corners
  - Thin borders (1-2px) with slightly higher contrast than contents
  - Translucent backgrounds (80-90% opacity) with subtle sand texture
  - Consistent 8px grid system for all UI element spacing
- Create distinctive iconography
  - Simple, recognizable symbols with 2px stroke weight
  - Angular design language consistent with Dune aesthetic
  - Limited detail to ensure clarity at small sizes (minimum 16×16px)
  - Consistent icon size and placement within interface

## Requirements

### 15.1 HUD Refinement
- Apply Dune fonts, color palette, and 8px grid spacing to all existing HUD elements (resource bars, interaction prompts, objective tracker, stealth indicator, chat preview). Ensure contrast ratios are met (min 4.5:1).
- Use subtle angular container shapes for grouped elements.
- Ensure performance optimization from M14 is maintained. Add opacity control setting.

### 15.2 Menu System Refinement
- Apply Dune aesthetic (fonts, colors, angular shapes, grid spacing, subtle textures) to Main Menu, Pause Menu, Settings Menu, basic Inventory (M8), Mission Log (M11), Clan UI (M13).
- Ensure smooth transitions (200-300ms) between menu states.
- Implement basic Server Browser UI (placeholder list, styled). Implement basic Character Customization UI (placeholder, styled).

### 15.3 Feedback and Guidance Refinement
- Style existing feedback (hit indicators, objective updates, interaction confirmations) using Dune palette/icons.
- Ensure waypoint markers (M11) use Dune iconography and colors.

### 15.4 Accessibility Implementation
- Text Size: Implement setting (Low/Medium/High) affecting base font size for secondary font. Ensure UI layout reflows correctly.
- Colorblind Modes: Implement client-side post-processing shader or CSS filters simulating Protanopia, Deuteranopia, Tritanopia. Test UI usability.
- Key Remapping: Implement UI in Settings menu allowing users to remap all core game actions. Save mappings to `localStorage`.

### 15.5 Social and Community Features (UI Only)
- Friend List UI: Implement UI panel displaying placeholder friend list. Style according to Dune guidelines. Add buttons for "Add Friend", "Remove".
- Team Management UI: Basic UI panel showing current team members. Style using Dune guidelines.
- Emote Wheel UI: Implement basic radial menu UI for selecting emotes (M9). Trigger appropriate `C_PLAY_EMOTE` message. Style using Dune guidelines.

## Deliverables
- All core UI elements consistently styled using the Dune Visual Identity Guidelines.
- Functional HUD displaying game state correctly with Dune aesthetics.
- Navigable Main, Pause, Settings menus with Dune aesthetics.
- Basic Inventory, Mission Log, Clan UI styled.
- Core accessibility features implemented (Text Size, Colorblind Filters, Key Remapping).
- Styled UI placeholders for Server Browser, Char Customization, Friends, Team, Emote Wheel.

## Testing and Validation
- All visible UI elements consistently use the Dune visual style guide.
- Core accessibility features are functional and usable.
- UI performs well and scales reasonably across different resolutions (e.g., 1080p, 1440p).
- UI rendering does not significantly regress performance gains from M14.