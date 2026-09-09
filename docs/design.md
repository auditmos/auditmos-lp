# Auditmos design manual

**Owner:** Tomasz Kowalczyk · **Issued:** 2026-09-09 · **Scope:** websites, case studies, reports, interactive tools, and video. Video appearance is covered in § 16.

Create work that a technical buyer can inspect, understand, and trust. Auditmos should feel like a named senior practice with unusually clear evidence: precise typography, cyan used with restraint, authentic human presence, and the useful structure of an engineering report.

## 1. Read this before creating anything

This is a self-contained working manual. Its business authority is [brand-strategy.md](https://github.com/auditmos/auditmos-lp/blob/main/docs/brand-strategy.md), including the owner's eleven design-interview decisions. The strategy overrides older PRD requirements where it explicitly supersedes them. The website PRD's historical references to company-only presentation, first-person founder sections, equal service prominence, and the rejected phrase "audit-grade delivery" do not restore those directions.

Three labels distinguish the instructions below:

| Label | Meaning | How to use it |
|---|---|---|
| **Approved** | Owner-approved strategy or interview decision | Preserve it; do not silently replace it with a generator's preferred aesthetic. |
| **Existing** | Observed asset, token, or implementation pattern | Reuse where suitable. Existing code is not proof that every use is accessible or a permanent brand rule. |
| **Default** | Proposed operational specification derived for this manual | Use as the starting point without another interview. Adjust for a demonstrated content or accessibility need; do not describe it as separately owner-approved. |

The numeric type, spacing, logo, and motion specifications marked Default are usable starting specifications, not claims that the website already satisfies them. Asset dependencies and review limits are explicit in § 12–13.

Before composing, establish the reader, the decision or action, the delivery format, available evidence, confidentiality, and available assets. Ask only for missing facts that affect truthfulness or an unresolved brand choice. Do not ask a user to choose CSS breakpoints or chart-axis mechanics.

## 2. Universal identity and voice — Approved

- **Position:** senior software delivery first. Security audits and applied R&D are real offers; public audit work demonstrates the delivery standard. Never present three interchangeable, equally weighted consultancy pillars on a general introduction.
- **Audience:** agencies and consultancies needing senior capacity they can trust with their clients; technical founders and CTOs are the secondary audience. Speak to handover, production, ownership, and reputational risk before listing technologies.
- **Authorship:** company-first, openly the independent practice of Tomasz Kowalczyk. Use "Auditmos" or "we"; founder biographies use third person. First-person writing belongs where Tomasz actually speaks under his own name.
- **Tone:** plain-spoken senior engineer; specific, calm, mildly understated. Explain the failure mode, intervention, evidence, and limits. Avoid superlatives and claims such as "cutting-edge," "passionate," or "world-class."
- **Recognition phrase:** "Don't take our word for it. Read the audits." Short action form: "Read the audits." Keep the words stable; typographic apostrophes are acceptable. Use it with the evidence it points to, not as an obligatory heading on every artifact.
- **Do not revive:** "audit-grade delivery" or "Built as if it will be audited." These are retired copy directions, not alternative slogans.
- **Durable assets:** English-first. The website is English-only. Polish personal LinkedIn content is a distinct channel, not a requirement to localize this site.
- **Web3:** show relevant audit work honestly; do not make crypto imagery or terminology the general identity.

**Default copy pattern:** reader's situation → what Auditmos did or will deliver → inspectable support → qualification → useful next step. Separate an engagement promise from a measured result. "We will provide reproduction steps" is a deliverable; "This change eliminated failures" requires result evidence.

| Prefer | Avoid | Why |
|---|---|---|
| "Review the findings and their reproduction steps." | "Industry-leading security expertise." | Offers something inspectable. |
| "The pilot completed the tested workflow; production rollout remains pending." | "Production-proven automation." | Preserves the actual stage and scope. |
| "Software delivery · Security audits · Applied R&D" as separate context | Another tagline embedded in the logo | States the offer without competing with the recognition phrase. |

Do not copy business counts, client statistics, prices, dates of operation, or repository totals from this manual. Retrieve them from the current source of the specific claim. The historical proof table in the strategy is not a live data feed.

## 3. Logos, authorship, and asset handling

### Approved direction

Use the official wordmark and icon. The typeset **"A/" is retired from new work** and must not stand in for either. Slash labels remain allowed; they are a graphic convention, not a logo.

The target wordmark has **no tagline**. Where the reader needs context, set **"Software delivery · Security audits · Applied R&D"** nearby as independent text. It may wrap or be omitted at small sizes. Do not invent another slogan.

Tagline-free masters were prepared in the local branding repository on 2026-09-09 as a subsequent owner-requested asset task. Use `branding/wordmark/` for new work. Existing consumers may retain supplied lockups containing "Secure your space" intact under the legacy exception until migrated; do not repeat that wording as standalone copy. Do not crop out lettering or redraw the wordmark. The wordmark variants are tracked in the branding repository under `wordmark/` (introduced in commit `586548d`).

### Existing asset inventory

Brand source: [auditmos/branding](https://github.com/auditmos/branding). The remote inspection used commit `cf997ccaa091b6959d058d0116b3f0ea31de96dd`; inspect the actual asset when that repository changes.

| Asset | Exact source/reference | Appearance and use |
|---|---|---|
| Current tagline-free wordmark | `branding/wordmark/auditmos-wordmark-{cyan-transparent,black-transparent,white-transparent,cyan-on-black,black-on-white}.{svg,png,pdf}` | Original eight lettering paths, no tagline; explicit foreground/background names. SVG canvas 738 × 134; PNG 2214 × 402. See `branding/wordmark/README.md` and `preview.png`. Tracked in the branding repository. |
| Full transparent lockup | `branding/full-logo/auditmos-full-logo-transparent.svg`; website copy: `src/assets/logos/auditmos-full-logo-transparent.svg` | Cyan artwork, embedded legacy tagline, substantial transparent canvas. |
| Other full lockups | `branding/full-logo/auditmos-full-logo-black.svg` and `auditmos-full-logo-white.svg`; matching website copies | Black-background/cyan and white-background/black treatments respectively. Filenames describe background variants. |
| Alternate logo exports | `branding/logo/auditmos-logo-{black,white,transparent}.{svg,png}` | These also include the legacy tagline. Do not interpret the directory name as a new approved lockup. Inspect each export's bounds. |
| Owner-selected icon | [icon/auditmos-icon-black.png](https://github.com/auditmos/branding/blob/main/icon/auditmos-icon-black.png) | Cyan symbol on an opaque black square. The square is part of this PNG. |
| Transparent icon | `branding/icon/auditmos-icon-transparent.svg`; website copy: `src/assets/logos/auditmos-icon-transparent.svg` | Official cyan symbol with transparent surroundings; suitable on dark brand surfaces. |
| White-background icon | `branding/icon/auditmos-icon-white.png` and `.svg` | Black symbol on white. This is not a white symbol for dark surfaces. |
| Founder photo | `branding/photography/tomasz-kowalczyk.jpg`, 640 × 640; usage: `branding/photography/README.md` | Approved natural-color portrait; unchanged copy of supplied `tk_sm.jpg`. Website copy: `src/assets/photography/tomasz-kowalczyk.jpg`. Published in branding commit `0ad4530`. |
| Existing OG image | `public/og.png`; source `scripts/og-image.html` | Existing artwork, not a compliant template for future marks; see § 12. |

Paths starting `branding/` identify files in the branding repository; remove that prefix when resolving them inside its checkout. Website paths are relative to `auditmos-lp`. The current website wordmark copy is `src/assets/logos/auditmos-wordmark-cyan-transparent.svg`. Prefer the supplied SVG equivalent for scalable output, preserving geometry and intended color/background. Do not make a PNG's black square disappear with blending modes.

### Geometry and placement — Default

Measure **visible artwork**, not the SVG element box. Legacy full-lockup SVGs use a `1024 × 768` viewBox; icons use `200 × 200`. Both contain unused canvas. An image set to `width: 144px` does not contain 144px-wide visible lettering. The website currently does this; it is not the minimum-size rule. New wordmarks use a `738 × 134` canvas with deliberate half-symbol-height clear space: approximately 671.574 units of visible lettering, so 144px visible width requires about 158.3px image width.

- Let **H** be the visible symbol height, excluding canvas padding. Keep at least **0.5H clear space** around the visible lockup or standalone symbol. Measure to neighboring text, borders, and trim edges; transparent padding may satisfy the space but must not obscure alignment.
- Start at **144 CSS px visible wordmark width** for a tagline-free screen lockup, **32mm** for print. For the legacy lockup, start at **240 CSS px / 50mm** and enlarge if its tagline is not legible. These are proposed minimums requiring inspection of the final export.
- Standalone symbol: **24 CSS px visible height / 6mm** minimum for ordinary placement. Favicons are a separate optical check at 16px and 32px; use the official symbol, not the full lockup or a typeset imitation. A container may need to be larger because of internal padding.
- Align visible lettering with the content edge. Website header: leading edge. Report: cover/masthead, with a quiet running identifier inside if needed. Tool: compact header outside the working controls. Do not watermark every chart or repeat a large logo in every section.
- Use cyan on a dark field; black artwork on light. The website's `brightness(0)` treatment is an existing controlled conversion to black, not permission for arbitrary filters. Prefer explicit approved export variants for portable artifacts.
- The new white-transparent wordmark is a monochrome reversed export for dark placement when cyan is unsuitable. It does not replace cyan as the primary brand treatment.
- Keep proportions, spacing, symbol shape, and lettering intact. No stretching, rotation, outline, glow, shadow, gradient recoloring, decorative clipping, letter substitution, or attaching verification seals to the mark. Do not place it over visually busy photography.

Whitespace-only export normalization is acceptable when preparing canonical assets in the branding repository; it must preserve all artwork and clear space. That is different from deleting the legacy tagline through display cropping.

### Founder portrait — Approved treatment, Default placement

Use the supplied authentic portrait: natural color and skin tones, light simple background, dark shirt, arms crossed. Preserve recognizability; no cyan tint, dramatic effects, synthetic replacement, invented working environment, or mirrored face. Crop proportionally without cutting through the face. Start with the supplied square crop and a rectangular image boundary; do not apply the CTA's clipped corner to the face.

Use it beside the founder introduction, author biography, or appropriate report authorship. It is not mandatory hero imagery and does not replace evidence. A report need not repeat a portrait on interior pages. Use `alt="Tomasz Kowalczyk"` when the image identifies him; avoid redundant announcements when equivalent adjacent content already supplies its purpose.

The approved owner-supplied portrait is stored in the branding repository as `photography/tomasz-kowalczyk.jpg` (640 × 640), an unchanged copy of `tk_sm.jpg`. Its usage notes are in `photography/README.md`. The portrait and usage notes are published in branding commit `0ad4530`: [portrait](https://github.com/auditmos/branding/blob/main/photography/tomasz-kowalczyk.jpg), [usage notes](https://github.com/auditmos/branding/blob/main/photography/README.md). The homepage uses a vendored copy at `src/assets/photography/tomasz-kowalczyk.jpg` in place of the former "TK" placeholder, with intrinsic dimensions, lazy loading, and the original square crop. If the asset is unavailable in another environment, retain a truthful text identity. This is not a high-resolution print master; inspect final-size quality before enlarging it.

## 4. Color and theme

### Approved behavior

Preserve cyan `#04d9ff`, with restrained use on dark brand compositions. The website follows the system theme and exposes a visible Light / Dark / System override. Printable reports are light-first; promotional artwork uses a dark treatment. Tools adapt to their reading environment. Light mode is a complete composition, not an inverted screenshot.

Use cyan for primary action, selective emphasis, and relevant data emphasis. Use darker teal for readable accent text on light surfaces. Success/error colors denote actual states; favorable-looking numbers do not become green by default. Information, caveats, and series distinctions need labels as well as color.

### Exact existing tokens

Snapshot of `src/styles/globals.css`. `light-dark(light, dark)` lists the light value first. Keep these names when working in this website; for another renderer resolve the appropriate values. Do not paste `@theme` into a non-Tailwind renderer and assume it defines CSS variables.

```css
--color-brand-accent: #04d9ff;
--color-brand-ink: light-dark(#00788c, #04d9ff);
--color-accent-contrast: oklch(0.148 0.01 220);
--color-success-text: light-dark(#166534, var(--color-emerald-100));
--color-error-text: light-dark(#991b1b, var(--color-red-100));
--color-neutral-50: light-dark(#132226, #fff);
--color-neutral-100: light-dark(#1c2c31, oklch(0.97 0.006 220));
--color-neutral-200: light-dark(#26383d, oklch(0.922 0.008 220));
--color-neutral-300: light-dark(#34484d, oklch(0.87 0.01 220));
--color-neutral-400: light-dark(#43585e, oklch(0.708 0.012 220));
--color-neutral-500: light-dark(#536a70, oklch(0.556 0.014 220));
--color-neutral-600: light-dark(#60767d, oklch(0.439 0.015 220));
--color-neutral-700: light-dark(#728a91, oklch(0.371 0.015 220));
--color-neutral-800: light-dark(#c9d8dc, oklch(0.269 0.014 220));
--color-neutral-900: light-dark(#edf4f6, oklch(0.205 0.012 220));
--color-neutral-950: light-dark(#f8fbfc, oklch(0.148 0.01 220));
```

The current installed Tailwind definitions resolve `--color-emerald-100` to `oklch(95% 0.052 163.051)` and `--color-red-100` to `oklch(93.6% 0.032 17.717)`. These are dependency values, not additional owner-approved palette choices; resolve again on a dependency change.

| Role | Existing starting token | Default application |
|---|---|---|
| Canvas | `neutral-950` | Continuous reading surface. |
| Subordinate surface | `neutral-900` | Inputs, genuinely grouped panels; opacity variants are existing implementation choices. |
| Heading / body / supporting text | `neutral-50` / `neutral-300` / `neutral-400` | Supporting text must remain readable; caveats are not decoration. |
| Structural rule | `neutral-800` | Quiet section/table boundaries, not necessarily a sufficient control boundary. |
| Primary action | `brand-accent` fill + `accent-contrast` text | The fill stays cyan in both themes. Do not use white text on cyan. |
| Link / focus | `brand-ink` | Underline prose links; verify focus against adjacent surfaces. |
| Success / failure | `success-text` / `error-text` | Include explicit state text; match the actual outcome. |

**Default extensions:** information uses `brand-ink` plus a label; pending/unknown uses readable neutral text. Use a labeled neutral caveat when no warning palette is needed. If an artifact needs warning color, start with `light-dark(#92400e, #fde68a)` and a textual "Warning" label; this is a proposed artifact-local value, not an existing site token. Similarly, choose extra chart series colors only when needed, test both themes, and combine them with direct labels or differing line/marker styles. There is no approved rainbow severity or chart palette to invent by name.

Never infer adequate contrast from a token name. Bright cyan text on the light canvas is unsuitable for normal reading; use `brand-ink`. Do not push source notes into low-contrast `neutral-600` merely to make a chart quieter.

Computed from the exact opaque sRGB values using relative luminance: `#04d9ff` on `#f8fbfc` is **1.63:1**, while `#00788c` on `#f8fbfc` is **4.97:1**. This verifies those two solid-color pairs only; opacity, other surfaces, and actual component states need their own checks.

## 5. Typography and hierarchy

**Approved roles:** Space Grotesk headings, system sans-serif body, IBM Plex Mono labels/references/code/selected numbers. Avoid adding another font family for an individual artifact.

Exact existing stacks:

```css
--font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
  "Segoe UI", sans-serif;
--font-display: "Space Grotesk Variable", ui-sans-serif, system-ui, -apple-system,
  BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Consolas,
  "Liberation Mono", Menlo, monospace;
```

Existing files: `src/assets/fonts/space-grotesk-latin-wght-normal.woff2` (normal, weights 300–700) and `src/assets/fonts/ibm-plex-mono-latin-400-normal.woff2` (normal, weight 400). Both use `font-display: swap`; only Latin glyphs are vendored. Verify Polish names and other diacritics with the actual fallback fonts. Do not fake bold mono when the supplied face only has weight 400. Reports must use fonts the renderer can embed; verify substitutions rather than silently changing the hierarchy.

### Reusable scale — Default unless labeled Existing

Sizes below use a 16px reference root; preserve user zoom and relative sizing. Pick a role consistently across peers, rather than choosing each heading independently.

| Role | Screen starting size / leading / weight | Application |
|---|---|---|
| Marketing H1 | 48 → 72px; homepage may reach 96px / 1.02–1.03 / 600 | Existing page pattern; reserve for concise opening offers. |
| Report/tool title | 32 → 48px / 1.15 / 600 | Gives the evidence or working controls room in the opening view. |
| Marketing section | 30 → 36–48px / 1.15–1.2 / 600 | Select one desktop role for peer sections; not every page needs 48px. |
| Reading H2 | 30px / 1.2 / 600 | Existing `.prose h2`. |
| Reading H3 | 20px / 1.35 / 600 | Existing `.prose h3`. |
| Body / long reading | 16px / 1.65–1.75 / 400; long reading 18px / 1.75 | Existing prose is `1.125rem`; tool body may use 16px. |
| Introduction | 18–20px / 1.6–1.75 / 400 | Brief context, not every paragraph. |
| Labels / metadata | 12–14px / 1.4–1.6 / 400 | Mono for useful structure; use 14px for important qualifications. |
| Evidence values | 24–48px / 1.1 / 400 mono or 600 display | Equal role and size for comparable values; use tabular numerals. |
| Print body / notes / H1 / H2 | 11pt / 9pt / 26pt / 17pt | Starting print scale; body leading 1.45, headings 1.2. Check at actual size. |

**Default:** keep prose around 60–75 characters per line. Wide tables and diagrams may exceed the prose measure. Use sentence-case headings; uppercase is allowed for short mono orientation labels. Avoid tracking ordinary paragraphs or making every heading an eyebrow. References such as `Fig. 02` must identify a real figure; numbers used for sequence must have a meaningful order.

Keep introductions near their content and give a new subject more space than a continuation. Existing prose uses a 24px inter-block gap, 56px before H2, 40px before H3, and 32px before H4. These values support sustained reading; they are not the spacing for compact tool controls.

## 6. Composition and the restrained signature

**Approved:** adapt composition to the format. Slash labels orient, clipped corners identify primary actions, and thin hatch bands mark major boundaries. Blueprint grids and crosshairs belong only in selected covers or technical figures. Never stack all motifs by default.

### Working composition rules — Default

Give each opening one dominant subject: the offer on a marketing page, the finding on a report, or the controls and result in a tool. A second column may hold subordinate context; it must not compete as a second headline. Build sections around distinct reader questions, not a repeated sequence of arbitrary card grids.

Use an 8px spacing rhythm with 4px adjustments: 4/8 within tight groups, 12/16 between related items, 24/32 between groups, 48/64/96 between major sections. This is a compositional default, not a newly installed token API. Use alignment and spacing before adding a container; use borders to reveal a real grouping or interaction. Square corners are the ordinary shape; a small 4px radius is acceptable for utility surfaces. Do not force custom geometry onto native controls.

| Format | Opening and structure | Evidence and ending |
|---|---|---|
| Website landing page | Offer → audience/context → linked recognition phrase → primary contact action and secondary audits action | Proof strip, dev-led services, selected work, founder, agency context, contact. Preserve the current homepage's approved order. |
| Case study | Specific project title, concise outcome/context, client or internal provenance | Problem → intervention → evidence → limits → relevant next step. Use actual content, not empty mandatory sections. |
| Report | Quiet identity, title, date/version/scope, central finding | Findings with references, methods and caveats, actionable next steps. Separate observed result from recommendation; light-first print pages. |
| Interactive tool | Short purpose statement, working controls, result | Model assumptions, source/time basis, validation and useful export/reset where relevant. Do not delay the tool below a marketing hero. |

For print, start with A4 and 18–22mm margins, repeating table headers, page numbers, and kept-together figure/caption pairs. Preserve searchable text and working references. For client-owned or white-label deliverables, the engagement's authorship agreement governs visible branding; never add Auditmos branding to a client's artifact merely because this manual was used.

### Motif specification

| Motif | Existing geometry | Default restraint / prohibition |
|---|---|---|
| Slash label | `eyebrow`: mono, 12px/16px, uppercase; CSS prepends `// ` with empty spoken alternative | One useful orientation label per section at most; omit when the heading already does its job. No slashes on every control or paragraph. |
| Clipped corner | `corner-cut`: top-right 45° cut of `0.625rem` (10px) | Primary action only; not all cards, screenshots, portraits, or logo frames. Ensure the focus ring is not clipped. |
| Hatch band | `bg-hatch`: −45°, cyan at 45% mixed with transparent, 1px stripe every 6px | Start at 8px band height, at an artifact boundary; ordinarily one band per page/cover. Never behind reading text or as hazard semantics. |
| Blueprint dots | `bg-blueprint`: 1px dots, `neutral-400` at 18%, 24px spacing | At most one selected diagram/cover field; omit behind body text or dense chart marks. This is not a mandatory website background. |
| Crosshair | `crosshair`: 11 × 11px, 1px strokes, `neutral-500` | A pair at meaningful border intersections in a selected composition is enough. Not targeting imagery, status, or a fake technical measurement. |
| Evidence label/stamp | No existing reusable component | Start with a square-corner 1px rule, mono label, readable source/scope text. No distressed seal, certification emblem, or unqualified checkmark. |

Treat purely decorative motifs as hidden from assistive technology. On narrow screens omit optional dots/crosshairs before reducing content size. Restraint does not prohibit the brand's actual slash labels, cyan, or hatch signature; do not import another company's blanket ban on them.

## 7. Evidence, charts, and truthful verification

### Approved evidence rules

Place support beside the claim. Use real artifacts, attributable people, or substantiated numbers. A public report label means publication, not that the audited system is safe. "Verified" requires the named check, scope, responsible party, date, and supporting evidence. No invented certifications or seals of approval.

Confidential results may support specific public claims only with a retained source and publication permission. State the basis and confidentiality limitation nearby. Do not imply that anonymization proves permission. Say "reference available on request" only when an actual reference arrangement exists. Private evidence receives no public-verification stamp.

### Evidence records and display — Default

For each material claim, retain: statement, source identifier/link, evidence owner, observation period/version, units/population, methodology, publication permission if relevant, and limitations. Public display includes the fields needed to interpret the claim; do not expose private source locations or client identifiers. An internal retained reference supports editorial traceability, not public access.

Public citation pattern: **Source: [specific artifact], [section/version/date]. [Material caveat].** A report can use numbered references, but a nearby reference marker must resolve to the exact item. Link to the relevant report, case-study section, release, or measurement, rather than a generic library when a precise source exists. Date dynamic snapshots and avoid presenting stale values as live.

Illustrative templates below contain placeholders, not Auditmos claims. Fill them with actual evidence or omit the element:

```text
Public report · [report reference]
Scope: [reviewed system/version] · Published [date]
Read report → [artifact URL]

Tested · [specific check]
Result: [observed result] · Scope: [version/environment]
By: [responsible party] · Date: [date] · Evidence: [source]
Limit: [what this does not establish]

[Permitted private result]
Basis: [measurement method and period]; underlying records are confidential.
[Include “Reference available on request” only if arranged.]
```

Do not use a success-color stamp for "Public report" or "Source available." Availability is not a passing test. Where tests are incomplete, say which checks passed and what remains untested; do not reduce a mixed outcome to "Verified."

**Metrics:** show unit, time window, population and basis near the number. Distinguish counts from rates, measured from estimated, totals from increments, pilots from production, and Auditmos's contribution from a whole client's scale. Do not use project complexity counts as automatic proof of quality. Match precision to the measurement. Omit unsupported metrics rather than filling a proof strip with invented values.

**Charts:** choose bars for magnitude, lines for change over time, scatter for relationships, and tables for exact lookup. Length-encoded bars start at zero and share the same scale among peers. A justified nonzero line-axis range must be explicit. State denominators for rates and use comparable periods/populations. Do not draw percentages as raw counts, sum overlapping categories, imply causation from correlation, or use 3D/pictorial size to inflate differences.

Align peer chart labels, plot starts/ends, and value columns with shared tracks. Direct-label series where practical; use a legend only when it reduces clutter. Cyan can identify the focal series, but not an unsupported winner. Show thresholds and uncertainty only when sourced, and distinguish observed data from projections through labels and line style. Missing data is not zero. Provide a readable caption and equivalent data table or text description.

**Tables/comparisons:** use descriptive headers and explicit units. Left-align text, right-align numbers and their headers, with consistent precision. Give dense evidence the full content width before shrinking it into a prose/sidebar split. Before/after comparisons must share a basis and state changed conditions; qualitative comparisons are appropriate when no defensible numeric delta exists. A capability comparison must not suggest competitors were tested when they were not.

**Worked illustration, synthetic data:** suppose the same task on the same workload/environment has median duration 120 seconds before and 90 seconds after, with 30 runs in each condition. Use two bars on a shared 0–120-second scale and say "Median task duration decreased by 25% in this test." Show the run count and methodology beside them. Do not say "25% faster business operations": the sample describes one tested task. A real report also needs its actual variability, source, date and changed conditions. These numbers are teaching data and must not appear as an Auditmos result.

For the planned Agent Coverage reporting described in [prd-agent-coverage.md](https://github.com/auditmos/auditmos-lp/blob/main/docs/prd-agent-coverage.md), preserve its specific evidence distinctions: aggregate-only public data, separate verified/claimed tiers, and file-level coverage for whole-page fetches. A fetch does not establish line-level reading or comprehension. Present the classifier's method, period, and limits alongside its vocabulary; do not turn a product-specific "verified" tier into a general seal of approval. This is guidance for that planned surface, not a claim it ships today.

**Testimonials:** use only approved real wording and permitted attribution: person, role/organization as allowed, and relevant engagement context. Do not invent, combine speakers, or silently rewrite a quote. Mark meaningful omissions; label a paraphrase as a paraphrase rather than putting it in quotation marks. Named testimonials are the strategy's intended proof class; absent approved quotes, omit the section. Do not generate names or publish placeholder praise. An anonymous quote needs a specific owner decision before it becomes a new testimonial convention.

## 8. Screenshots, diagrams, and icons

**Approved:** imagery must provide evidence or explanation. Use genuine screenshots and system-grounded diagrams; clearly label schematic UI examples. No decorative stock or AI imagery, fake product screenshots, invented infrastructure photos, shields-as-trust, or background code wallpaper.

**Default handling:**

- Screenshots retain the relevant interface and version context. Crop to the reader's question; preserve enough context to understand the state. Label redactions and never alter data to improve the story. Remove confidential information irreversibly in any future publishable derivative, including hidden layers/metadata; retain the original privately.
- Show screenshots as figures with captions identifying the product/state and what to notice. Provide a readable detail crop if the full screen is too small. Do not recolor a real product UI into Auditmos cyan or frame it in a fictitious browser to imply a live deployment.
- Diagrams use plain labeled nodes, explicit boundaries, and arrows with a defined direction/meaning. Distinguish current, proposed, and external components. Use actual system facts; label an explanatory simplification. Provide a text equivalent and explain uncommon abbreviations.
- Use consistent line icons, starting at a 20–24px box with 1.5–2px stroke. Prefer a visible action label; hide a redundant icon from assistive technology. An icon-only button needs an accessible name and sufficient hit area. No new icon dependency is required by this manual.
- Keep imagery secondary unless it is the decisive evidence. Avoid mandatory hero media and repeating the founder portrait as decoration throughout an artifact.

## 9. Interaction, accessibility, and responsive behavior — Default

Build on native semantics and test with keyboard and assistive technology. For web output, target WCAG 2.2 AA: normal text contrast 4.5:1, large text 3:1, and meaningful controls/graphics 3:1 where applicable. Preserve visible, unobscured focus, text resizing to 200%, and reflow at 320 CSS px except genuinely two-dimensional content. Never rely on color alone. These are standards-based acceptance targets, not a claim that existing pages pass. See the [W3C quick reference](https://www.w3.org/WAI/WCAG22/quickref/).

Auditmos's proposed control target is **44 × 44 CSS px** where practical; this is a design default above the AA minimum, not a claim that WCAG universally requires it. Give compact controls enough spacing and test actual keyboard and touch use.

| State | Required behavior |
|---|---|
| Default / hover | Clear affordance and readable label; hover cannot be the only route to information. |
| Focus | Visible ring on the actual interactive target; source order follows reading order; no trapped focus. |
| Selected / expanded | Native state or accurate ARIA state plus a visible non-color cue. |
| Loading | Name the operation, prevent accidental duplicate action where appropriate, preserve context. No fake progress percentages. |
| Success | Confirm the actual completed operation, not an inferred downstream outcome. |
| Error | State what failed and the next useful action; preserve entered values and associate field errors with fields. |
| Empty / unavailable | Explain what is absent; distinguish no data, no results, and failed retrieval. Never substitute fabricated values. |
| Disabled | Explain why when it is not obvious; do not make low opacity the only explanation. |

Use one descriptive H1, ordered headings, landmarks, a working skip link, native form labels, semantic tables, and figure captions. Preserve input autocomplete and useful input modes. Announce asynchronous results concisely without reading a whole dashboard on every change. A dropdown/dialog needs appropriate dismissal, focus handling, and keyboard semantics; prefer native elements before inventing a widget. Ordinary links stay links; actions that change state use buttons.

**Motion:** start with the existing 150ms color/background/border transitions. Small directional movement may reinforce an action, but is optional and must disappear with reduced motion. No scroll-gated reading, pulsing proof badges, count-up evidence, typing simulations, parallax, or autoplay decoration. Reduced motion disables transforms and animation as well as transitions; simply making a transition near-instant is not sufficient for every future animation.

**Tools:** define variables, units, ranges, defaults, formulas, dependencies, source dates, and rounding. One control owns a variable; calculate from full precision and format for display. Label assumptions and estimates. Preserve invalid input and explain it instead of silently clamping it. Keep the last valid result labeled as such; update dependent results together. Reset restores documented defaults. A network failure must not masquerade as a fresh result.

**Responsive composition:** stack secondary context after the primary content; wrap controls and labels at word boundaries; let grids shrink with `min-width: 0`. Never conceal page overflow as a fix. Keep wide evidence in an intentionally local scroll region only when reflow cannot preserve the lookup task. Ensure the region can be reached and understood by keyboard. Preserve source/caveat proximity when columns stack. Check both themes, zoom, long names, and actual empty/error states.

## 10. Website-specific implementation reference — Existing

These paths and conventions apply to `auditmos-lp`; other artifacts inherit the brand principles, not Astro or Tailwind as a requirement. Read `package.json` for current versions rather than freezing framework/package versions into this manual.

| Surface | Source | Reuse guidance |
|---|---|---|
| Shared shell | `src/layouts/Layout.astro` | Metadata, header, navigation, skip link, footer and theme assets. Do not clone the shell per page. |
| Theme | `src/components/ThemeSelector.astro`, `src/brand/theme.ts` | Native select; `auditmos-theme` storage key; `data-theme="system|light|dark"`; `color-scheme` and `light-dark()`. |
| Global foundation | `src/styles/globals.css` | Exact brand/font tokens and motif utilities. `@source "../**/*.astro"` constrains utility discovery. |
| Long-form content | `src/styles/prose.css`, `src/pages/work/[slug].astro` | Import prose styles from the rendering page. They are not part of the global homepage budget. |
| Service structure | `src/components/ServicePage.astro` | Offer first; suitability and deliverables have distinct sections. Avoid restoring the retired hero sidebar. |
| Work library | `src/pages/work/index.astro`, `src/content/projects/` | Preserve capability filters, truthful client/internal provenance, and authored content. |
| Brand/business data | `src/brand/site.ts`, `src/audits/reports.ts`, `src/oss/projects.ts` | Read current values; do not embed duplicate business figures in design examples. |
| Inquiry form | `src/pages/contact.astro` | Native labels, anti-spam integration and explicit feedback. Reuse behavior deliberately; inspect states rather than copying every class. |

Existing layout foundation: `max-w-7xl` = 80rem; horizontal padding `px-5` = 1.25rem, `sm:px-8` = 2rem. Typical section padding is 4rem rising to 6rem; the homepage hero reaches 8rem on large screens. Breakpoints are `sm: 40rem`, `md: 48rem`, `lg: 64rem`. These are website patterns, not universal report geometry. Long-form prose currently caps at `max-w-3xl` = 48rem; judge its actual character measure with the selected body font.

Example using existing website utilities; no new component API is implied:

```astro
<section aria-labelledby="deliverables-title">
  <div class="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
    <p class="eyebrow text-brand-ink">Deliverables</p>
    <h2 id="deliverables-title" class="mt-4 font-semibold text-3xl text-neutral-50">
      Findings your team can reproduce.
    </h2>
    <p class="mt-5 max-w-2xl text-neutral-300 leading-7">
      Each finding includes the affected scope, reproduction steps, and a proposed fix.
    </p>
    <!-- Use this promise only when it matches the actual engagement deliverables. -->
  </div>
</section>
```

Preserve static-first rendering, semantic HTML, page markdown twins, and `/llms.txt` coverage. Do not convert readable content into a canvas or image to obtain a visual effect. Introducing a page also requires its existing routing/discovery conventions; refer to `AGENTS.md`. Interactive tools may require JavaScript for their task, but a brand manual does not authorize new endpoints, bindings, or deployment.

The footer on every website page identifies **Auditmos OÜ · Reg 17025406 · VAT EE102758111 · Narva mnt 13-27, 10151 Tallinn, Estonia**, plus the privacy/contact links. Use the shared `legalEntity` source in code. Legal identifiers belong in verification/contact surfaces, not automatically in a hero. Reports use an appropriate issuer/colophon rather than repeating the full website footer on every page.

## 11. Anti-patterns to reject

- Rebranding Auditmos as a generic security vendor, three-equal-pillars agency, or anonymous team; restoring retired phrases.
- A typeset "A/", an AI-redrawn logo, a fictitious tagline-free asset, or a new competing slogan.
- Every section using slashes, numbers, hatch, grid, crosshairs, cyan headings, and a stamp simultaneously.
- A decorative "Verified" checkmark, a public-report badge read as certification, or a result with its caveat hidden in tiny text.
- Invented clients, testimonials, counts, source links, screenshots, progress indicators, or proof dates.
- Repeated panels around ordinary prose; split layouts that starve the evidence; an oversized promotional hero above a tool.
- Copying the current light-mode cyan prose links, clipped focus treatment, or low-contrast metadata without checking them.
- Banning Auditmos's actual motifs or theme selector because another brand's manual bans them. Equally, inventing a reusable CSS API from another brand's class names.

## 12. Comparison with representative existing work

**Review basis:** source inspection of the pages/components/styles below, visual inspection of `public/og.png`, the supplied portrait, and branding PNG variants. This is a documentation compatibility check, not a rendered website or accessibility audit. No page or artwork was redesigned during the original documentation task. The subsequent wordmark asset task is recorded in § 3 and § 13.

| Representative surface | Consistent with this manual | Difference and intended handling |
|---|---|---|
| Homepage, `src/pages/index.astro` | Offer-first single hero; proof links; dev-led service order; founder; two featured slots adapt to availability | The owner-authorized rollout replaces "TK" with the approved natural-color portrait. Some metric links point to `/work` generally; new claims should use precise evidence where available. Do not reinstate the removed aside or principles section. |
| Service pages, `ServicePage.astro` | Single opening offer followed by suitability, detail, and deliverables | Existing numbered rows are implementation patterns, not a mandate to number every list. Preserve useful hierarchy; do not add report decorations automatically. |
| Work index and GPU fleet case study | Explicit provenance, filters, authored problem/intervention detail and comparisons | A title/context split can serve a case study without authorizing a competing marketing hero. Private figures need the retained-source/permission basis; this review did not verify underlying client records. |
| Case-study prose | Clear H2/H3 hierarchy, lists, code, tables | Bright `brand-accent` links/inline code bypass light-mode `brand-ink`. Table cells are universally left-aligned. For new work use accessible accent text and numeric column alignment; existing CSS fixes are separate work. |
| `/partners` and `/about` | Agency-specific terms, founder identity, entity verification; absent testimonials stay hidden | Do not copy generic operating-principle claims as proof. A new named quote requires actual approved source material. |
| Contact form and shared shell | Visible labels, feedback regions, native theme select, skip link | Check clipped-button focus, low-emphasis text, navigation selection cues, and all submit states in a browser. "Message sent" does not establish downstream email delivery. No runtime pass is claimed here. |
| OG artwork, `public/og.png` | Cyan/dark, approved offer, font family, recognizable signature | The owner-authorized rollout replaces typeset "A/" with the official transparent icon and the legacy lockup with the tagline-free wordmark. The selected-cover grid/crosshairs are allowed; their density is not a page-wide default. |
| Future printable reports and tools | Approved common identity with format-specific density | No shipped template was reviewed. The light report and compact tool recipes are proposed defaults, not descriptions of existing implementations. |

## 13. Remaining dependencies and decisions

All eleven owner interview choices are resolved. No further general brand judgment prevents using this manual. The following constraints remain explicit:

| Item | Status | Consequence / safe fallback |
|---|---|---|
| Tagline-free logo masters | Prepared in `branding/wordmark/` on 2026-09-09; SVG/PNG/PDF variants verified | Tracked in the branding repository for new work. The cyan transparent SVG is vendored into the website and used by its header, footer, and OG source. Supply the files to other environments rather than guessing remote URLs. Physical print appearance is untested. |
| Founder portrait portability | Published in `branding/photography/tomasz-kowalczyk.jpg` with usage notes | Available from the branding repository; the homepage uses a vendored copy. Use text identity if the asset is unavailable. |
| Existing OG's "A/" replacement | Implemented using the official transparent SVG | Confirm the served OG image after each artwork deployment. |
| Testimonials and confidential claims | Need real material/permission per artifact | Omit unsupported content. The manual does not grant client publication permission. |
| Numeric logo/type/layout defaults | Proposed; not independently ratified or tested across renderers | Start here, inspect final output and revise for legibility. Do not describe them as established historical brand measurements. |
| Named Polish content format/cadence | Still open in brand strategy | Does not block websites, reports, case studies, or tools; do not invent a recurring branded series name. |

## 14. Verification checklist for generated work

Use this checklist on the actual output. Record each applicable item as verified, failing, not tested, or awaiting source/asset, with evidence. A checklist in a manual is not proof of a generated artifact's compliance.

- [ ] **Identity:** reader understands the offer or report/tool purpose; approved voice and service emphasis; no retired phrase, false authorship, or "A/" substitute mark.
- [ ] **Assets:** correct official variant, visible bounds, clear space and final-size legibility; legacy exception explicit where relevant; real portrait accessible; no guessed filenames.
- [ ] **Hierarchy:** one dominant opening subject; repeatable type roles; readable measure; meaningful section order; no empty grid slots or arbitrary motif accumulation.
- [ ] **Color/themes:** exact current brand values; readable text/focus/control combinations; equivalent hierarchy in both themes; selected/state meaning also conveyed without color.
- [ ] **Evidence:** each material claim has its actual basis, period/scope and caveat; private claims have retained sources and permission; every link resolves to the intended evidence; no volatile figures copied from old design copy.
- [ ] **Charts/tables:** correct units, scales, denominators and precision; no misleading baseline or missing-as-zero; aligned peer encodings; readable captions and accessible data alternative.
- [ ] **Imagery/quotes:** authentic screenshots and portrait; redactions identified; schematics labeled; testimony and attribution approved; no fabricated endorsements.
- [ ] **Interaction:** complete keyboard flow, visible unobscured focus, associated labels/errors, selected/loading/empty/failure/success states; retained input; truthful result freshness and calculations.
- [ ] **Reflow/motion:** inspect narrow 320px layout, representative tablet/desktop, 200% text enlargement and zoom/reflow; local evidence scrolling only when justified; reduced motion preserves a complete static experience.
- [ ] **Export/print:** when applicable, inspect actual-size pages, font embedding/fallbacks, grayscale meaning, page breaks, repeated table headers, captions and working references.
- [ ] **Website integration:** when code changes, preserve shared layout, provenance, markdown/discovery and project performance constraints; run the required `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm knip`. Measure numeric performance criteria under the specified conditions rather than estimating them.
- [ ] **Video:** apply § 16; inspect typography, composition and overlays at playback size, plus motion and reading time.
- [ ] **Handoff:** enumerate verified and unverified criteria. State any missing evidence/assets or real-environment checks; do not call an artifact verified because its source compiles.

Reference method: [Vercel's design.md](https://vercel.com/design.md) informed the depth of instruction and review, not Auditmos's aesthetics or restrictions. Auditmos's palette, font roles, visible theme control, restrained report motifs, official assets, and human presence remain its own.

## 15. Verification of this manual — 2026-09-09

This table records the original documentation task. The subsequent owner-authorized website rollout is recorded below.

| Requested criterion | Status | Evidence |
|---|---|---|
| Establish approved decisions, implementation patterns, and gaps before drafting | Verified | Strategy/PRD, assets, styles, shell/components and representative page source inspected; distinctions preserved in § 1 and § 12. |
| Interview the owner and record accepted decisions in the strategy | Verified | Q1–Q11 answered; decisions recorded in strategy § 4–5 and resolved-input history in § 9. |
| Self-contained universal and website guidance with exact existing tokens | Verified | § 2–10; all 19 color/font declarations mechanically compared with `globals.css`, with no differences. |
| Asset references, examples, anti-patterns and verification checklist | Verified | § 3, § 6–11 and § 14; 20 explicit website file/directory references checked, plus both documents' relative Markdown links. |
| Compare representative pages and explain intentional differences | Verified | Source/artwork comparison in § 12; no claim of a rendered browser audit. |
| Keep pending decisions/assets explicit and avoid volatile business figures | Verified | § 13; dynamic evidence points to its source; synthetic example explicitly labeled. |
| Documentation-only scope; no dependency install, website change, endpoint or deployment | Verified | Working-tree review: only `docs/brand-strategy.md` and new `docs/design.md` changed for this task. |

The original documentation task did not test browser accessibility, responsive rendering, printed artifacts, downstream client evidence, or application code. The generated-work checklist in § 14 applies to subsequent implementation.

**Subsequent website rollout:** the header, footer, and regenerated OG artwork use the tagline-free wordmark; OG artwork uses the official icon. `/design.md` is a prerendered, byte-for-byte publication of this document, listed in `/llms.txt`, with an explicit Markdown response type. No second editable copy is maintained. The production URL becomes available after deployment; local preparation is not evidence of production availability. Print output and private client evidence remain unverified.

## 16. Video appearance — Default

Apply the Auditmos identity in § 3–6 to moving slides. The following defaults define its visual adaptation to video.

### Color and surfaces

Use the dark or light palette from § 4 with the same hierarchy: canvas `neutral-950`, subordinate surface `neutral-900`, headings `neutral-50`, body `neutral-300`, supporting text `neutral-400`, rules `neutral-800`. Cyan `#04d9ff` identifies selective emphasis; use `brand-ink` for readable accent text, especially on light backgrounds. Code may retain a dark surface with light text in either variant.

Prefer a flat canvas and generous whitespace. Use square corners or a small 4px radius on utility surfaces. A single accent rule may anchor a title. Blueprint dots, hatch and crosshairs follow § 6's restraint; do not place a permanent grid, glow or gradient behind every slide.

### Typography

Preserve § 5's font roles: Space Grotesk for headings and dominant statements, system sans for explanatory text, IBM Plex Mono for code and references. Use actual font weights and glyphs for the content language, including Latin Extended for Polish. Set quotations in normal display type rather than synthesizing italics.

Starting sizes below are output pixels for 1920 × 1080 landscape or 1080 × 1920 portrait. Scale proportionally for other resolutions.

| Role | Landscape | Portrait | Leading / weight |
|---|---|---|---|
| Opening title | 80–96px | 68–80px | 1.1 / 700 display |
| Statement, quote or list item | 48–56px | 44–52px | 1.3 / 700 display |
| Supporting prose | 36–40px | 36–40px | 1.4 / 400 body |
| Label, attribution or source | 24–28px | 28–32px | 1.4 / 400 mono |
| Code | 28–32px | 30–34px | 1.6 / 400 mono |
| Captions, when present | 36–42px | 40–48px | 1.25 / 500 body |

### Composition

Give every slide one dominant subject. Align related elements to a common left edge and use § 6's spacing rhythm. At the reference resolutions, start with 170px horizontal and 120px vertical margins in landscape; in portrait, 120px horizontal, 240px top and 220px bottom. Reserve additional space for destination controls and any captions or authorship. These are composition defaults, not guaranteed platform-safe regions.

Reflow portrait content into a single column. Keep text, captions and portrait in separate regions. Simplify or split crowded content before reducing type. Check legibility at mobile playback size.

| Slide | Treatment |
|---|---|
| Title | At most three headline lines and two subordinate lines; optional single accent rule. |
| Quote or statement | One short idea; attribution below when applicable. No oversized decorative quotation mark competing with the text. |
| List | Up to five landscape or three portrait items, at most two lines each. Number only when sequence is meaningful. |
| Code | A focused excerpt in a quiet dark panel; emphasize discussed lines. Omit decorative desktop window controls. |
| Screenshot | Preserve proportions and readable context. Crop deliberately; highlights must stay aligned with the visible subject. |
| Ending | One takeaway with an optional relevant action or source; retain the opening's hierarchy. |

### Brand elements and overlays

Use the official wordmark and clear space from § 3, optionally on the opening or ending. Avoid a large repeated logo on every slide. An optional presenter portrait keeps its authentic colors and rectangular crop, without a glow or accent ring. Place a subordinate readable name beside it; use text identity if the portrait is unavailable.

Captions, when present, use at most two lines with a contrasting solid or sufficiently opaque backing. Keep them clear of the main content and presenter. Sources remain readable and close to the claim they qualify.

### Motion

Keep movement quiet and purposeful: a 0.4-second crossfade between slides and a 0.4-second fade-in with at most 20px upward travel at the reference resolution, easing out without bounce. No flashing, decorative zoom or continuous movement behind reading text. Reveal list items sequentially and leave earlier items visible. Allow at least 3 seconds of stable reading time after the final item appears. A static view must show the complete composition.
