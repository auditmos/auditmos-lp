# Brand & Business Strategy — Auditmos

**Status:** Locked v1 · **Owner:** Tomasz Kowalczyk · **Date:** 2026-07-16
**Method:** Negacz framework (business strategy → brand strategy → positioning → assets → proofs → consistency), decisions taken in structured Q&A on 2026-07-16.
**Supersedes:** parts of `prd-website-rebuild.md` where they conflict (see § 8).

**Design update 2026-09-09:** owner-approved interview decisions are recorded in § 4–5; § 9 records resolved choices and remaining asset work. `docs/design.md` supplies the working manual and separately labeled operational defaults.

**Update 2026-09-07:** § 3, § 4, § 7 and § 8 reconciled against what actually shipped. Two contradictions inside this document were removed rather than carried forward: § 7's copy rule mandating "audit-grade delivery" verbatim (§ 4 records the owner rejecting that phrase), and § 7's first-person copy rule (the site moved to practice voice in `412777f`). The homepage section list in § 7 now describes the shipped page — it had been prescribing the structure the 2026-09-07 simplification removed, and a later pass reading it would have restored both the deleted section and the rejected phrase.

---

## 1. Business strategy

**The bet: dev-led, audit-flavored.** Auditmos leads with senior software delivery. Security audits and applied R&D remain offers, but they are the *credibility engine*, not the headline — the differentiator is "software built by someone who audits systems for a living."

**Primary audience (the 95%):** software agencies and consultancies that need senior capacity they can put in front of their own clients. Their core fear is not cost — it is reputational damage with *their* client (a subcontractor who ghosts, over-promises, or ships something that collapses at handover). Auditmos sells the removal of that fear.

**Secondary audience:** CTOs/founders of EU startups and scale-ups (direct engagements, margin upside, where the brand compounds toward over time).

**Market sequencing: Poland-first network, English-first assets.** The near-term revenue engine is the Polish software-house network (LinkedIn content and relationships in Polish). All durable brand assets (site, case studies, artifacts) are built in English from day one so the same touchpoints compound toward EU direct clients. The site stays English-only.

**Price position:** premium (Emirates, not Ryanair). Senior-led, evidence-heavy, margin premium. Never compete on rate; compete on "nothing blows up."

**Anti-goals:** not a body shop, not the cheapest option, not a generalist agency, not a three-equal-pillars consultancy.

## 2. Positioning

> For software agencies and technical leaders who cannot afford a delivery failure in front of their client, **Auditmos is the safe pair of hands**: senior software delivery that survives handover, production, and scrutiny — run by an engineer who audits systems for a living.

**The word to own:** *safe pair of hands* (the association), carried by the brand mechanism of **public receipts** — *"Don't take our word for it. Read the audits."* (Chosen 2026-07-16; the earlier candidate "audit-grade delivery" was rejected by the owner. Wording and placement have since been revised twice — see § 4.)

The receipts mechanism resolves the name tension: *Auditmos* stops meaning "an audit company" and starts meaning "the practice whose work you can inspect before hiring" — 24 audit reports public on GitHub since 2021. Per the fame × uniqueness test, publishing audit reports in public is owned by almost nobody in the dev-services space, and it is verifiable in one click.

**Positioning guardrails**

- Every service is framed through de-risking, not capability. Not "we build software" → "your project stops being the risky one."
- Audits appear as proof of the delivery standard first, standalone offer second.
- Never lead with technology lists; lead with what survives (handover, audit, production, due diligence).

## 3. Brand strategy

**Architecture: hybrid.** Company-first brand, openly a personal practice. The site says plainly that Auditmos is the independent practice of Tomasz Kowalczyk — named founder section with face and LinkedIn link; content is published under Tomasz's name. This replaces the earlier "company-only, no bios, no photos" decision. (Rationale: for a solo B2B practice, the founder's face is the highest-leverage recognition asset, and agencies vetting a subcontractor trust a named human over an anonymous "we.")

**Brand promise:** *nothing reaches your client that wouldn't survive an audit.*

**Tone of voice (a recognition asset in itself):**

- Plain-spoken senior engineer. Specifics over adjectives — every adjective should be replaceable by a number or an artifact, or it gets cut.
- Practice voice ("Auditmos"/"we") across the site; the founder bio is third person. *Revised 2026-08-05 in `412777f`, superseding the original first-person-singular rule* — "I" on a page a CTO reads as a company page felt smaller than the work, and the founder section carries the human without the whole site speaking as one person. First person stays where Tomasz genuinely speaks: LinkedIn content under his name.
- No marketing superlatives, no "passionate," no "cutting-edge." Dry confidence, mild understatement, concrete failure-mode talk (the way engineers actually assess risk).

**Brand level goal (Negacz's 4 levels):** today between level 1–2 (salesperson explains everything from zero / neutral). Target: level 3 within ~12 months — a warm prospect arrives already knowing "Tomasz / Auditmos = the safe hands, audit-grade guy" from repeated LinkedIn touchpoints.

## 4. Recognition assets

Assets pass the test: **fame × uniqueness** (how many people connect it with Auditmos × how few connect it with anyone else). Consistency over years beats novelty; none of these get changed on a whim.

| Asset | What it is | Status |
|---|---|---|
| Name | *Auditmos*, reframed by the public-receipts mechanism | Exists; reframed via copy |
| Phrase | **"Don't take our word for it. Read the audits."** — hero proof line, directly under the headline; short form "read the audits" on the CTA | Adopted 2026-07-16 (replaces rejected "audit-grade delivery"); "my" → "our" with the 2026-08-05 voice change; moved from H1 to proof line 2026-09-07 |
| Receipts | github.com/auditmos/audits — 24 public reports, linked from hero, services, /partners | Exists; now load-bearing |
| Face | Tomasz — photo on site, name on content, consistent presence | Natural-color portrait supplied and approved 2026-09-09; homepage integration prepared locally, deployment pending |
| Color | `#04d9ff` cyan on dark | Exists; keep, but it is not distinctive alone |
| Visual signature | Restrained engineering-report language: useful mono labels and references, selective motifs, evidence labels with explicit scope (§ 5) | Restraint and evidence-label direction approved 2026-09-09 |
| Content format | One recurring, named teardown-style format (e.g. anonymized "what I found in the system I inherited" posts) in Polish on LinkedIn | New — name and cadence TBD with first posts |
| Tone | As defined in § 3 | Adopt everywhere at once |

**Notes**

- The dark-tech-with-accent aesthetic is a sea of sameness (the video's white-on-black critique). The cheapest real differentiator is the *human* (photo, voice) plus the audit-report visual language — not a palette change. Full visual rebrand is explicitly out of scope for now.
- Rule from the video: these assets don't need to please the owner; they need to be memorable and consistent. Changing the phrase, format, or face treatment resets the clock to zero.
- **Why the phrase left the H1 (2026-09-07).** It rebuts a trust objection the visitor has not formed yet, because they do not yet know what is being claimed. Measured against the PRD's own 60-second criterion the page failed: "software development", "security audits" and "applied R&D" appeared nowhere above the fold, and the services section sat fourth. The headline now states the offer and the phrase sits immediately beneath it, verbatim and linked to the reports — same first screen, same wording, one slot down. The words were not changed; only what they are asked to do.
- **One phrase, not two (2026-09-07).** "Built as if it will be audited" had been running in parallel — the hero aside, the OG card headline, a service promise, the markdown twin. Two candidate phrases halve each other, so it was retired everywhere and the OG card rebuilt. Watch for it creeping back: it reads well, which is exactly why it kept getting written.

### Visual signature and cross-format use

**Approved 2026-09-09, design-manual interview (Q1 A, Q3 A).**

- **Restrained signature:** slash labels provide useful orientation; clipped corners identify primary actions; thin hatch bands mark major boundaries. Blueprint grids and crosshairs are reserved for selected covers or technical figures. Do not stack all motifs by default. These treatments support the content rather than becoming mandatory decoration in every section.
- **Shared identity, format-specific composition:** websites, case studies, reports, and interactive tools share logo rules, type families, cyan, voice, and evidence standards. Website openings can be spacious; printable reports are light-first; case studies prioritize sustained reading; tools use compact layouts with controls and results prominent. Do not copy the website's marketing-page composition into every format.
- These decisions guide new work; they do not request a redesign of existing pages. Detailed logo geometry and reusable layout specifications are proposed defaults in the design manual. Remotion and video are outside this design-manual scope.

### Typography, themes, and explanatory imagery

**Approved 2026-09-09, design-manual interview (Q7 A, Q8 A, Q9 A).**

- **Typography:** Space Grotesk for headings, system sans-serif for body text, IBM Plex Mono for labels, references, code, and selected numbers. These roles are reusable brand decisions; size scales adapt to the format. The current site's exact font stacks and vendored faces remain the implementation reference.
- **Themes and color:** the website retains system-default light/dark behavior and a visible user override. Promotional artwork uses dark treatments; printable reports are light-first. Cyan identifies actions and selective emphasis; darker teal provides readable accent text on light surfaces. Semantic colors communicate actual states, not an unsupported positive or negative judgment. Exact current tokens belong in the design manual; their presence in CSS does not prove that every existing foreground/background combination passes contrast requirements.
- **Imagery:** real screenshots, explicitly redacted where necessary; diagrams grounded in the described system; consistent functional icons. Clearly labeled schematic UI examples are allowed, but must never masquerade as shipped products. No decorative stock or AI imagery. The approved founder portrait follows the natural-color rules below.

### Logo assets and founder photography

**Approved 2026-09-09, design-manual interview (Q4 A, Q5 A, Q6 A, with owner amendments).**

- **Legacy tagline exception:** existing consumers may retain supplied full-logo artwork intact until migrated; its embedded "Secure your space" is an asset exception, not a second copy phrase to repeat. New work uses the tagline-free wordmark prepared in the branding repository on 2026-09-09. Do not crop lettering out of legacy exports or redraw the logo.
- **Asset source:** the owner's local branding repository is `/Users/tkow/Documents/Code/Auditmos/branding`, corresponding to `https://github.com/auditmos/branding`. Both `logo/` and `full-logo/` contain existing lockups; do not assume `logo/` is tagline-free. Existing vendored website assets are not the complete branding library.
- **Replacement direction (Q10 A, approved 2026-09-09):** a clean, tagline-free wordmark. Where context is needed, set "Software delivery · Security audits · Applied R&D" nearby as separate text, never embedded into the logo. "Don't take our word for it. Read the audits." remains the recognition phrase in proof-oriented copy. No replacement slogan is needed. **Asset follow-up delivered 2026-09-09:** `branding/wordmark/` contains cyan/black/white transparent, cyan-on-black and black-on-white SVG/PNG/vector-PDF variants preserving the original eight lettering paths; see its `README.md` and `preview.png`. The wordmark variants are tracked in branding commit `586548d`. The subsequent owner-authorized rollout vendors the cyan transparent SVG into the website header/footer and OG artwork.
- **Official marks only:** retire the typeset "A/" from new work and replace its existing use in a later implementation task with the official icon. The owner's explicit reference is [icon/auditmos-icon-black.png](https://github.com/auditmos/branding/blob/main/icon/auditmos-icon-black.png). Inspected at repository commit `cf997ccaa091b6959d058d0116b3f0ea31de96dd`: this is a cyan icon on an opaque black square, not a black-colored icon. The repository also supplies SVG and transparent/white-background variants; use the actual artwork and appropriate background treatment, never infer appearance from a filename alone. Slash labels remain approved and are not substitute logos.
- **Founder portrait:** natural color, understated presentation, simple background, natural skin tones, consistent crop; no cyan tint, dramatic effects, or synthetic replacement. The owner supplied `tk_sm.jpg` in the interview (640 × 640 portrait, light background, dark shirt, arms crossed) as the approved reference. Preserve its authentic appearance; do not imply that a future shoot is required. On 2026-09-09, at the owner's request, an unchanged copy was stored in the branding repository as `photography/tomasz-kowalczyk.jpg`, with usage notes in `photography/README.md`. The portrait and usage notes are published in branding commit `0ad4530`; the homepage now uses a vendored copy at `src/assets/photography/tomasz-kowalczyk.jpg`, replacing the "TK" placeholder in the next deployment.
- **Scope history:** the original design-manual task documented these decisions without editing artwork. A subsequent owner-requested asset task prepared the new wordmark variants above. The owner subsequently authorized website/OG asset replacement and publication of the design manual at `/design.md`; both are prepared locally for the next deployment. The owner then authorized replacing the homepage's "TK" placeholder with the approved portrait; this is prepared locally.

## 5. Proof assets

Every claim on the site must sit adjacent to its proof. Available proof classes (confirmed 2026-07-16): **referenceable people, numbers, public artifacts.** (No certifications to lean on — do not fake that column; omit it.)

| Proof | Claim it backs | Status |
|---|---|---|
| 24 public audit reports, 2021–2025 (github.com/auditmos/audits, incl. Kujira, Stargate Finance, Cookie3, StarHeroes) | The entire receipts mechanism | Live — linked from hero, security-audits, /partners |
| Antra engagement — Chief Software Architect; 500 servers, 3,000+ GPUs, 200 locations, 9 EU countries (public site figures) | Scale + "safe hands" | Numbers in hero strip without the name (owner decision); named case study at `/work/antra-compute-network` |
| 2 own products live — wizytowka.link (95k+ localities), powiadomienia.info (early access) | Ships end to end | Case studies live |
| 7 open-source repos (saas-on-cf ★12 et al.) | Technical depth, inspectability | /open-source aggregator |
| Named quotes from agency owners / clients | "Safe pair of hands," /partners | **Still pending** — testimonial sections are wired but render only when quotes exist (owner: "leave a space") |

**Web3 flavor decision (2026-07-16):** receipts, not identity — the reports and a few client names are shown proudly, framed as "security audits"; the site does not read as a crypto shop.

**Placement rule:** no proof, no claim. If a section can't be backed yet, it ships weaker-but-true rather than strong-but-hollow.

### Evidence labels and verification stamps

**Approved 2026-09-09, design-manual interview (Q2 A).** A stamp is a specific evidence label, not a generic seal of approval. Use treatments such as "Public report · [reference]" or "Tested · [scope/date]", linked to supporting evidence. "Verified" requires a named check, its scope, the responsible party, and the date. Publication alone does not establish that a system passed testing, and a stamp must not imply certification or a broader review than the evidence supports.

**Private evidence (Q11 A, approved 2026-09-09):** specific claims may rely on non-public evidence when a retained source substantiates them and publication permission exists. State the basis and confidentiality limitation beside the claim. "Reference available on request" is allowed only when that arrangement actually exists. Private evidence receives no public-verification stamp. Anonymization does not substitute for permission or substantiation.

## 6. Channel plan (the 95/5 rule)

95% of the addressable market isn't buying this quarter. The touchpoint engine for them is **not the website** — it is:

1. **LinkedIn (personal profile, Polish, primary):** the recurring teardown format + engagement in the PL software-house circle. Target cadence: sustainable > ambitious (1×/week beats 3×/week for a month then silence).
2. **Public artifacts (English):** OSS, talks, technical writing — durable, compounding, linkable from everywhere.
3. **The site:** conversion + verification surface for warm traffic the channels create. It must confirm in 60 seconds what the touchpoints promised: real human, real track record, safe hands.

## 7. Landing page implications (spec for the rebuild)

Diagnosis confirmed by owner (all four): interchangeable · wrong audience · claims without proof · not my voice.

**Homepage stays client-facing** (readable by a CTO — which itself proves to agencies this person can face their client), **plus a new `/partners` page** speaking openly to agencies.

### Homepage, section by section

*Describes the page as shipped after the 2026-09-07 simplification. The original eight-section spec is kept in § 8 with the reason each item changed.*

1. **Hero** — the offer, then the proof. H1 states what is sold ("Senior software delivery that survives the handover."); the subhead names the three service lines and the ICP's fear; the recognition phrase follows as a linked proof line. Two CTAs: `/contact` primary, the audits repo secondary. **No aside** — a second display-size element beside the H1 gives the first screen two focal points and no answer.
2. **Proof strip** (directly under hero) — 3–4 real numbers (§ 5). No numbers, no strip.
3. **Services** — software development first (lead offer), security audits second, applied R&D third. Carries the standfirst "Most contractors ask you to trust them. We'd rather you check." Third on the page, not fourth: this is the section a first-time visitor came for.
4. **Selected work** — two cards, chosen for breadth rather than recency. One card in a two-up grid reads as an empty shelf.
5. **Founder section** — photo, one paragraph, LinkedIn link. Still the single biggest "not interchangeable" fix.
6. **Partners teaser** — one honest paragraph for agency visitors → `/partners`.
7. **Contact CTA** — keep shape.

**Retired: the "audit-grade delivery" section.** It existed to make that phrase appear a third time; the owner rejected the phrase (§ 4), and what shipped in its slot was a generic four-item principles list whose every claim was already made elsewhere on the page. It also duplicated the services section's exact markup, so the two read as one undifferentiated wall. Its one non-duplicated line moved to the services standfirst. **Do not reinstate it** — if the delivery standard needs stating, it belongs inside the service rows, not as a second numbered list above them.

### `/partners` (new page)

Speaks to the agency owner's actual fear, using practice voice (§ 3): your client stays your client (non-compete stance, stated plainly); white-label vs named collaboration modes; how handover and communication work; an agency-owner quote. Add to the MD-mirror + `/llms.txt` surfaces per the site convention.

### Copy rules for the rewrite

- Practice voice throughout; the founder bio is third person (§ 3, revised 2026-08-05).
- Every adjective replaceable by a number or artifact, or cut.
- **"Don't take our word for it. Read the audits."** appears verbatim — hero proof line, and the short form "read the audits" on CTAs (asset repetition). It is the only recognition phrase; do not introduce a second (§ 4).
- No eyebrow or heading that makes a claim with no proof beside it. "A useful first conversation" and "Receipts" over case studies were both cut on those grounds.

## 8. Superseded / updated decisions

| Old decision (PRD / discovery) | New decision |
|---|---|
| About is company-only; no bios, no photos, no individuals | Hybrid: founder section with name, face, third-person paragraph; content under Tomasz's name |
| Homepage = hero + 3 equal service teasers | Dev-led hierarchy; audits reframed as credibility engine |
| No new pages beyond v1 list | `/partners` page added (agency ICP) |
| Copy direction "evidence, not claims" (CISO-flavored) | "Safe pair of hands" (agency + CTO flavored); proof-adjacent claims |

Later revisions to *this* document's own § 7 spec:

| Original § 7 decision (2026-07-16) | Revised | Why |
|---|---|---|
| First person for founder-voice sections | Practice voice; founder bio third person | 2026-08-05 (`412777f`) — see § 3 |
| Hero leads with the recognition phrase | Hero leads with the offer; phrase is the proof line beneath | 2026-09-07 — the page failed the PRD's 60-second "understand what Auditmos does" criterion; no service line appeared above the fold |
| An "audit-grade delivery" section, third | Section retired; services move third | 2026-09-07 — its purpose was repeating a phrase the owner rejected (§ 4); shipped content was a duplicate-claims list in identical markup to services |
| "Audit-grade delivery" appears verbatim in hero, services, /partners | Never use it | Contradicted § 4 from the day it was written; the phrase is absent from `src/` and should stay absent |
| Hero subhead names Tallinn | Location lives in the footer, `/contact` and `/about` vendor table only | 2026-09-07 — entity verification does not need hero space; JSON-LD carries it site-wide regardless |

Everything else in the PRD (architecture, MD-mirror, contact endpoint, static-first, no CMS, no blog *pipeline*) stands. The LinkedIn content plan (§ 6) lives off-site and does not reintroduce a blog into v1.

## 9. Open inputs

Resolved 2026-07-16: proof numbers (§ 5), artifact links, hero direction ("Read the audits"), Web3 framing (receipts-not-identity), Antra treatment (numbers in hero, name in case study). The LP rewrite shipped against this spec.

Resolved 2026-09-07: homepage hierarchy (offer above the fold, services third), the competing-phrase cleanup, and the OG card rebuilt to match the hero.

Resolved 2026-09-09 (design-manual interview, first batch): restrained visual signature and format-specific composition (§ 4); specific, evidence-backed verification labels (§ 5).

Resolved 2026-09-09 (second batch): legacy tagline exception with replacement artwork requested; official icon replaces the typeset "A/"; natural-color founder portrait supplied and approved (§ 4).

Resolved 2026-09-09 (third batch): reusable font roles; adaptive themes with visible website override; evidence-led imagery and clearly labeled schematic examples (§ 4). Local branding-repository location supplied; replacement treatment for the legacy tagline requested.

Resolved 2026-09-09 (final batch): clean wordmark with an optional separate service descriptor (§ 4), and qualified private evidence (§ 5). All eleven interview questions are answered. [The design manual](./design.md) translates those decisions into instructions, records current implementation tokens, and identifies proposed operational defaults separately from owner-approved brand rules.

Still open:

1. **Founder photo integration** — the portrait is supplied and approved (§ 4); durable asset storage is prepared locally in `branding/photography/`. The homepage's "TK" monogram is replaced locally with the approved portrait. The branding files are published; website deployment is tracked separately.
2. **Testimonials** — 2–3 named quotes from agency owners/clients; sections on `/` and `/partners` are wired and render automatically once quotes are added.
3. **LinkedIn content format** — name and cadence for the recurring Polish teardown format (§ 6).
4. **Operational defaults** — logo geometry, layout scales, accessible interaction, and truthful chart conventions are proposed defaults in `docs/design.md`, not separately ratified brand decisions. Use them as starting specifications and verify the actual output; do not treat current CSS as blanket proof of usability or accessibility.
5. **Brand rollout** — tagline-free wordmark assets are now prepared locally in `branding/wordmark/`. Website header/footer and OG consumers are migrated locally, including the official icon in place of typeset "A/". The branding assets are committed and published; website deployment is tracked separately.
