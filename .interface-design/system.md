# Shock Wheel interface system

Every UI change follows this file, including the Home premium tab. If a screen breaks a rule here, the screen is wrong, not the rule. The wheel is the one playful element; everything around it stays calm and disciplined.

References (patterns, not branding): **Linear** for density, hierarchy and keyboard flow; **Stripe Dashboard** for money tables, badges and detail drawers; **Ramp** for financial stats in a header.

## Banned

These read as AI-generated. Never ship them.

- Inter, Roboto, Arial or system-ui as the visible face (allowed only as fallbacks in a font stack).
- Purple or blue gradients, or any gradient wash used as decoration. No gradients at all.
- Every section in an identical white bordered box with the same shadow.
- Three-card feature grids.
- All-caps eyebrow labels.
- Meta strings joined with middle dots ("Mild · 0.5x shock"). Use separate labelled values or a clause.
- Arrows appended to button text ("Next →").
- Light grey text below 4.5:1. Body text in blue (reads as a link).
- Any text under 13px, anywhere, including badges, captions, chart labels and wheel labels.

## Tokens

### Colour

```css
--ground:        #EDF0F2;  /* page */
--surface:       #FFFFFF;  /* panels, table, drawer */
--ink:           #172030;  /* primary text */
--steel:         #56657A;  /* secondary text; the lightest text colour allowed */
--line:          #D3DAE1;  /* borders, dividers */
--brass:         #B8862B;  /* pointer, accents, focus ring ONLY; never text, never a fill behind text */
--brass-strong:  #8C6420;  /* filled buttons, white text */
--brass-ink:     #88611F;  /* text on --amber-tint */
--breach:        #B23A2E;
--breach-tint:   #F6E4E1;
--cleared:       #2F7A57;
--cleared-tint:  #E1F0E8;
--cleared-ink:   #2E7654;  /* text on --cleared-tint */
--amber-tint:    #F5EAD3;  /* medium priority, "depends on wording" verdicts */
--neutral-tint:  #E6EAEE;  /* low priority, Template/Claude tag */
--row-hover:     #F5F7F9;
```

Verified contrast (WCAG 2.1):

| Pair | Ratio | Use |
| --- | --- | --- |
| ink on ground / surface | 14.3 / 16.3 | body text |
| steel on ground / surface / row hover | 5.2 / 5.9 / 5.5 | secondary text |
| white on brass-strong | 5.3 | primary buttons |
| white on breach | 5.9 | CRITICAL badge |
| breach on breach-tint | 4.8 | HIGH badge |
| brass-ink on amber-tint | 4.7 | MEDIUM badge, "depends" verdict |
| steel on neutral-tint | 4.9 | LOW badge, source tag |
| cleared-ink on cleared-tint | 4.6 | "covered" verdict, good outcomes |
| breach / cleared on surface | 5.9 / 5.2 | money, signed values |
| brass on white halo | 3.2 | focus ring (non-text, needs 3:1) |

Adjustments to the brief, each forced by a contrast check: `--brass-strong` on `--amber-tint` measures 4.44 and `--cleared` on `--cleared-tint` measures 4.41, so text on those tints uses `--brass-ink` and `--cleared-ink`. Brass on `--ground` is 2.83, so the focus ring carries a white halo (see Focus).

### Type

- **Bricolage Grotesque**: headings, big numbers, wheel labels, the hub label.
- **Public Sans**: everything else.
- Scale (px): **32 / 24 / 19 / 16 / 15 / 13**. Nothing else.
  - 32: the landed result's headline number or name in the result panel
  - 24: header stats, panel titles
  - 19: section headings, explanation headline
  - 16: drawer subheadings, emphasized values
  - 15: body, table primary text, buttons, inputs (line-height 1.55)
  - 13: secondary text, table meta and headers, badges, labels, helper text (always `--steel` or darker)
- All money and counts use `font-variant-numeric: tabular-nums`. Numeric columns are right-aligned, headers included.
- Sentence case everywhere. Enum values are shown in sentence case ("Depends on wording", "Critical").

### Spacing, radius and elevation

- 4px base. Section gaps 32px. Inside panels 20–24px.
- Radius by role: badges **4px**; inputs and buttons **6px**; panels **10px**; the wheel housing is circular. Never one radius for everything.
- Elevation: **none on panels**. Shadows only on the drawer, modals and menus/popovers.

## Components

**Buttons.** 40px tall, 15px semibold, padding 0 16px, 6px radius.
- Primary: `--brass-strong` background, white text.
- Secondary: `--surface` background, 1px `--line` border, `--ink` text.
- Hover darkens 6%. No arrows or decorative icons in the label.

**Inputs.** 40px tall, 15px text, 1px `--line` border, 6px radius. Label 13px semibold `--ink` above the field; helper text 13px `--steel` below.

**Badges.** 24px tall, 13px semibold, padding 0 8px, 4px radius, no border.

| Priority | Background | Text |
| --- | --- | --- |
| Critical | `--breach` | white |
| High | `--breach-tint` | `--breach` |
| Medium | `--amber-tint` | `--brass-ink` |
| Low | `--neutral-tint` | `--steel` |

Status badges are a 6px dot plus text, no box: Open (brass dot), Assigned (steel), Escalated (breach), Resolved (cleared). The Template/Claude tag is a Low-style badge.

**Table.** 52px rows. Primary cell text 15px `--ink`; secondary line 13px `--steel` under the account name. Header 13px semibold `--steel`, bottom border only, sticky. No vertical lines, no zebra striping. Row hover `--row-hover`. Numeric columns right-aligned. Resolved rows use `--steel` text, never reduced opacity.

**Header stats.** Number 24px Bricolage `--ink`, label 13px `--steel` below. Open deficit is `--breach` only when greater than zero.

**Focus.** Every interactive element: `outline: 2px solid var(--brass); outline-offset: 2px;` plus `box-shadow: 0 0 0 2px var(--surface)` behind it, so the brass ring always sits on white. Table rows use an inset ring. Focus is never removed.

**Callouts and disclaimers.** A 3px left rule in the semantic colour on its tint, 13–15px text. Never a full box.

## Layout

- App shell max-width 1440px, centred.
- **Header**, 64px: product name, stats, user switcher, "Run margin sweep".
- **Left rail**, 460px, sticky on desktop: the wheel, spin controls, the result panel.
- **Right workspace** fills the rest: tabs **Queue / Run explanation / Coverage / Home premium**. The workspace fills the viewport height below the header, so there's no dead space; the table scrolls inside it.
- Containers differ by importance:
  - the wheel sits directly on `--ground`, no box;
  - the result is a bordered panel (`--surface`, 1px `--line`, 10px radius);
  - the workspace is one full-height surface; sections inside it are separated by spacing and a hairline, never boxed again.
- **Mobile (375px)**: single column, wheel first at full width, tabs become a segmented control, the table scrolls horizontally inside its own container. 16px gutters, no horizontal page scroll.

## The wheel

- Slice colours alternate lighter and darker tones so neighbours never blur together. Each slice declares its label colour, and that pair must pass 4.5:1.
- Labels are the short label only (max 14 chars, one or two lines), 13–14px Bricolage semibold at rendered size, set radially, flipped on the left half so nothing reads upside down or needs a head tilt. Full names live in the result panel.
- Pegs on the rim between slices; a brass flapper pointer that deflects as pegs pass and springs back.
- After landing, the hub shows the landed result's short label (or icon); the landed slice gets a 3px brass outline. Other slices stay full strength (no dimming).
- The server decides every outcome; the animation only lands on it. `prefers-reduced-motion`: no spin, jump straight to the result.
- Sound is optional and off by default.

## Explanation and analysis panels

- Full width in the workspace, text measure capped near 75 characters.
- Headline 19px Bricolage. On desktop, sections sit in two columns (first-order beside second-order); stacked on mobile.
- Bullet text is `--ink`, sentence case ("Insurance falls 9%"), never blue.
- Source tag (Template/Claude) is a Low-style badge.
- Anything that looks like advice carries its disclaimer as a callout directly under the output it qualifies.

## Process

Widget by widget, never all at once. For each widget, build three options that differ in **layout and hierarchy** (not just colour) on the dev-only route `/design-lab?widget=NAME`, screenshot them at 1440px, and wait for a pick before building it for real:

1. Header and stats
2. Wheel and result panel
3. Queue table
4. Account drawer
5. Explanation panel
6. Coverage / premium results

The design lab is excluded from production builds.

## Quality gate

Before calling UI work done:

- Playwright + `@axe-core/playwright`: load the app, spin with a fixed seed, open the drawer; fail on any serious or critical violation. Runs in CI.
- Screenshots of every screen at 1440px and 375px after the final build.
- Self-critique: list anything that still looks templated and fix it; remove one decorative element that isn't earning its place.
- `prefers-reduced-motion` respected, visible keyboard focus everywhere, all tests and the web build passing.
