# Cobalt Lab v2: agent rules

Apply these rules to every visual, UI or document you produce for Nícolas. Dark mode is the default theme. Light mode only for print, resume and PDF.

## Identity
- Vibe: research lab x engineering x editorial. Never startup, influencer or hacker.
- Forbidden: green-on-black terminals, CRT scanlines, glitch effects, Inter, JetBrains Mono.

## Layers
- Structure (type, grid, spacing, radius, star): calm, high contrast, never textured.
- Material (grain, dither, stipple, thermal, contours, dot grids, pixel and ASCII art): the personality.
- Motion: feedback first. Remove any animation that confirms nothing.

## Color (dark)
- surface #14161A, raised #1B1E24, sunk #0E1013
- text #ECE8DD, muted #93968D
- cobalt #2D7FD0 (shapes, strokes, large UI only), cobalt-light #8DB9E8 (links, small accent text, primary button fill with ink text), cobalt-deep #24445F (fills only)
- oxide #E97D4A: one highlight per view at most
- Light mode: paper #F3F0E6, ink #17191A, gray #75786F
- Text contrast: at least 4.5:1 against the worst pixel behind it, after grain and dither. UI strokes and icons at least 3:1.
- Put text on a plate (surface at 85 to 90% or a scrim) over any gradient or texture. Always for thermal stop 2 and the violet bridge.
- Primary button: cobalt-light #8DB9E8 fill with ink #14161A text (8.8:1). Never light text on a light fill (#ECE8DD on #8DB9E8 is 1.68:1).

## Gradients
- Main family: thermal. Stops: #0E1013, #24445F, #2D7FD0, #8E7CC3, #E97D4A, #F7D9A8. Interpolate in OKLCH.
- Always add grain to gradients (monochrome noise, 3 to 6%, static tile).
- Iridescent (#9FE3F0, #B9A6F0, #F2A6D0, #F4E3A1): its main form is the liquid sigil (see Star). One iridescent element per page, total. Never behind text. Never next to a full thermal gradient in the same component.

## Materials
- Dither: ordered Bayer 4x4, 4 px cells, 2 to 4 ramp colors, no antialiasing.
- Stipple: blue-noise dots, 0.5 to 2 px, density follows the gradient.
- Contours: 1 px, cobalt at 8 to 12%. Dot grid: square dots, 16 px pitch, 10 to 14% opacity.
- Layer order: surface, grid or contours, gradient, grain, plate, content.
- Budget per view: one gradient family, one extra texture besides grain, one hero element (ASCII video, pixel type or sprite).
- Every material needs a static fallback.

## Type
- Founders Grotesk and Founders Grotesk Text for headings and body.
- Paper Mono (fallback Berkeley Mono) for code, labels, metadata and all ASCII. Use its block and box-drawing glyphs for ASCII art and progress bars. Do not rely on italics.
- Newsreader for rare editorial moments. Cormorant Garamond for display only.
- Hero title: ABC Arizona (width 90, weight 600, SRFF 90, slant -5), once per page. Fallbacks: Canela, Instrument Serif.
- Pixel font: Silkscreen (alt Press Start 2P). Sizes 8, 16, 24 px. Uppercase, 24 characters or fewer. For stamps, counters, loader labels and section tags only.
- Never texture, dither or grain text.

## Star
- Four-pointed star, five forms: vector, pixel (5x5 or 7x7), ASCII glyph, thermal-filled, iridescent.
- Silhouette (all forms): four tips on the axes, needle-sharp tips, concave sides that curve inward. The curve gives the body its fullness. Never a straight-edged spike.
  - From each tip, a cubic curve to the next tip. In units of the tip distance R from the center, for the top tip heading to the right tip the handles are at (e, d - 1) and (1 - d, -e). Rotate by 90 degrees for each next side. Both handles run almost along the axes, so the tips are needles. d = 0.60, e = 0.015 (lower d is fuller, higher d is thinner). Waist about 40% of R.
  - Do not round the tips.
  - The star fills about 70% of its canvas and leaves transparent padding for shader edge effects.
  - Reference files: star-sigil-mask.svg (solid fill, for the LiquidMetal mask) and star-sigil-fallback.svg (iridescent gradient, for the static fallback), both 1024 by 1024. Use them as the source of truth. Needle tips can disappear below about 48 px, so the favicon and nav mark use the pixel star.
- Use it as marker, bullet, section break or signature. Never as decoration. Two or fewer per screen.

### Liquid sigil (liquid metal merged with iridescence)
- A liquid-metal render of the star whose stripes split into the iridescent pastels at the edges. It replaces the separate iridescent shape: one per page, and no other iridescent element.
- Use: landing hero (live, 240 to 480 px) and personal logo at hero scale or social images (exported still frame). Proposal for the logo: star plus the name in Founders Grotesk, only the star is liquid.
- Never use the live shader below 96 px. Nav, favicon, bullets and section breaks use the vector or pixel star. Resume PDF uses the solid vector star. Loader finished state uses the thermal star.
- Implementation: LiquidMetal from @paper-design/shaders-react, with the star as a transparent-background SVG or PNG mask. Do not use the built-in shapes.
- Start values (tune against the page background, keep them in one named constant): colorBack #00000000 (transparent, never an opaque color, since an opaque value paints a visible box over the gradient; if alpha is not honored, put the sigil on a plain surface plate), colorTint #B9A6F0, shiftRed 0.3, shiftBlue 0.3, repetition 2, softness 0.1, distortion 0.07, contour 0.4, angle 70, scale 0.6, speed 0.4, fit contain.
- Cap pixel ratio (minPixelRatio, maxPixelCount). Place it over the cold end of the thermal field or on a plain dark plate, never over the hot end.
- Static fallback: vector star with the four-pastel iridescent gradient. Use it for reduced motion, no WebGL, off-screen and print.
- Decorative by default (aria-hidden). If it is the logo, give it a text label.
- No sparkle on hover. Sparkle only on the final call-to-action click.
- Own marks only. Never apply it to third-party logos.
- If it renders as the flat pastel star, the fallback is running and the shader is not. Log which branch was chosen and why. Usual causes: a fallback check based on screen width or touch, the iOS Reduce Motion setting, a mask image that failed to load, a WebGL context error.

## Geometry
- 4 px unit. Spacing: 4, 8, 12, 16, 24, 32, 48, 64, 96. Radii: 4, 8, 12, 16, 24.
- Inner radius = outer radius minus padding, minimum 0. Under 2 px, use square corners. Compute it, never hand-pick it.
- Glass is optional: floating UI only (nav, palette, tooltip, sheet). One at a time. Blur about 20 px, white fill 6 to 10%, grain on top.

## Components
- Check existing components before building. Extend through props and tokens: size, tone, material, state.
- Loading, empty, error and success states ship with every component.
- Loading: pixel-star loader on the thermal ramp (default), 3-cell loader inside buttons, dither skeletons. Stepped animation, no easing. ASCII bar only for real progress.
- Focus: 2 px cobalt-light ring, 2 px offset.

## Motion
- Tokens: fast 90 ms, base 160 ms, slow 280 ms, hero 480 ms.
- Button press: scale 0.97. Knob while dragged: stretch 21% along travel. Success: one pulse, scale 1 to 1.06 to 1, 360 ms.
- Moves: ease-in-out cubic-bezier(0.65, 0, 0.35, 1), 240 to 360 ms.
- Rubber band past bounds: offset = (1 - 1 / (x * 0.55 / d + 1)) * d, then spring back.
- Sparkle (3 to 5 tiny stars, 400 to 600 ms): only on success, first-time unlock, final CTA click, copy confirmation. One at a time.
- Animate transform and opacity only.
- prefers-reduced-motion: opacity-only press feedback, no stretch, no rubber band, static star instead of sparkle, frozen grain and ASCII video.

## Creature field (reusable background)
- CreatureField: animated background of creatures drawn as square cells and a few dim characters. One species chosen at random per mount (never the same twice in a row). Click or tap scatters them. Koi are fed instead.
- Species: koi, butterfly, jellyfish, dragonfly, manta, fish-school.
- Render: 2D canvas on a cell grid, cell 8 CSS px (multiple of 4), with a `scale` prop (default 1) multiplying creature size in cells. Every creature cell is an ASCII character in Paper Mono (~10 px) pre-rendered into an atlas and blitted across three brightness levels with Bayer 4x4 dithered edges: brightest cells are a solid palette tile with a dark surface glyph (`# @ % &`), middle cells are a full-palette glyph with no tile (`* + = x o`), and dim cells are a ~45% tint glyph (`: . , '`). Each cell's glyph is locked to the creature's id and local coordinates so it never shimmers. Wakes and trails are dim mono characters (`. : - +`). Faint square dot grid behind.
- Color from tokens only, no rainbow: koi oxide, hot cream and text white. Butterfly and dragonfly cobalt and cobalt-light. Jellyfish violet bridge. Manta cobalt tints. Fish-school muted gray and cobalt-light. No lilac or iridescent pastels.
- Counts as the view's hero element and full-bleed canvas. No other full-bleed shader, ASCII video or pixel-type hero on the same view.
- Creatures steer around text plates and forms (avoid prop). Text still sits on a plate.
- Reduced motion: one still arrangement, no loop. Pause when off-screen and in hidden tabs. Frame work at most 2 ms on desktop and 4 ms with 4x CPU throttling. Under 20,000 cells.
- aria-hidden, not focusable. Ignore clicks on interactive elements and [data-creature-ignore]. Touch reacts to a tap only, never to a scroll.
- Full details are in the creature field prompt. Adding a species is one file plus one list entry.

## Content and voice
- Copy that is abstract, symmetrical and says little reads as generated. These rules apply to every word on the page. A section that cannot follow them is removed.
- Every section needs real content: a project, a role, a result or a way to get in touch. With none, the section does not exist. No placeholder cards, no "coming soon", and the site itself is not a project.
- Headings name the thing: Work, Projects, Contact. No poetic or abstract headlines.
- First person, short, concrete. Say what I did, with what, and what came out of it: tools, numbers, dates, links. A fact I cannot state is left out, not phrased around.
- Avoid: three-item lists used for rhythm, "not X but Y" reversals, "at the boundary between", "living space", "foundation", "built carefully", "I am passionate about", sentences held together with em dashes.
- A section never restates the hero. Numbered eyebrows (01 / WORK) only when there are more than three sections.
- Never invent facts, employers, projects, metrics or quotes. Use what is already on the page or ask Nícolas.
- The Design check reports on copy: filler sections removed, headings plain, no banned patterns, abbreviations and identity links follow the Semantics rules.

## Semantics
### Abbreviations
- Use the native `<abbr title="...">` element **only in pure body text** (prose paragraphs, descriptions, and summaries). The `title` holds the expansion and keeps the native tooltip.
  - `<abbr title="Artificial Intelligence">AI</abbr>`, `<abbr title="Laboratório de Inovação em Software">LiS</abbr>`, `<abbr title="Error Correction Codes">ECC</abbr>`
- **Avoid `<abbr>` outside pure prose**: never use it in heroes, headers, navigation bars, footers, headings (`<h1>`–`<h6>`), buttons, interactive links/cards, eyebrows, stamps, badges, or short monospace metadata labels.
- Mark the first meaningful prose occurrence on each page. Mark later prose occurrences where it stays useful and natural.
- Only use an expansion that is stated on the site or confirmed by Nícolas. Unknown or ambiguous terms stay unmarked and are not guessed. Open ones: NSESD, HP.
- Do not wrap contractions, code identifiers, URLs, product names that are not abbreviations (DevOps), or text inside `alt`, `aria-label`, `<title>` or meta tags, where markup is not allowed.
- Style: the default dotted underline, thinner and softened to 35% of the text color, no color change, no hover effect.
- Implementation: add the term to the glossary in `src/lib/abbreviations.ts` and render pure prose through `<Abbreviated>` (`src/components/Abbr.tsx`). Use `<Abbr title>` for a one-off in body text. Never write an `<abbr>` without a title.
- `npm run design:check` fails on: an `<abbr>` with a missing or empty title, a title that does not expand its text or differs from the glossary, a glossary entry without a real expansion, any `<abbr>` or `<Abbreviated>` placed inside heroes, headers, navs, footers, headings (`<h1>`–`<h6>`), buttons, links, or monospace uppercase UI labels, and an unwrapped glossary term inside pure prose JSX. Terms inside data strings (`src/content/site.ts`) are wrapped at render time, so new unknown terms are caught by the manual audit.
- Manual audit, on every content change: read each page as rendered, check pure body prose for all-caps or mixed-case short terms (confirming expansions in the content or with Nícolas before adding to the glossary), confirm heroes/headers/footers/headings/chrome stay free of `<abbr>`, and hover each `<abbr>` in prose to read the tooltip.

### Identity links
- A link to another online profile or identity page that represents me carries `rel="me"` (IndieWeb): GitHub, LinkedIn and any other personal or professional profile. Not for project docs, institution sites, ordinary references, internal navigation or `mailto:` links.
- Combine rel tokens, never overwrite them. A link that opens in a new tab keeps `noopener noreferrer` next to `me`.
  - `<a href="https://github.com/thenickfer" target="_blank" rel="me noopener noreferrer">GitHub</a>`
- Implementation: mark the contact with `identity: true` in `src/content/site.ts` and build `rel` with `buildRel` from `src/lib/links.ts` (`ExternalLink` takes an `identity` prop). A literal link to a profile uses the same component.
- `npm run design:check` fails when a contact on github.com or linkedin.com lacks `identity: true`, when a link to one of my profiles has no `rel="me"` or `identity`, or when a link built from `contact.href` ignores `contact.identity`. `npm test` covers `buildRel` and the real GitHub and LinkedIn entries.

## Responsive
- Mobile-first. Works from 320 to 2560 px wide, portrait and landscape. No horizontal scroll at any width.
- Test matrix (CSS px): 360x640, 375x667, 390x844, 430x932, 667x375 (phone landscape), 768x1024, 1024x768, 1366x768, 1440x900, 1920x1080, 2560x1080. Also a 320 px wide window and 200% zoom.
- Breakpoint tokens: 480, 768, 1024, 1440. Grid: 4 columns on phones, 8 on tablets, 12 from 1024. Content max width 1200 px, centered. Line length 45 to 75 characters.
- clamp() for type and section spacing, extremes snapped to the 4 px unit. svh or dvh, never vh. Respect env(safe-area-inset-*) on fixed and edge-aligned elements.
- Height under 500 px: compress the hero, shrink or hide the sigil, keep the title and primary action visible.
- Reserve media space with aspect-ratio. Below 768 px the nav collapses to a compact bar with a menu sheet.
- Touch targets at least 44x44 px, 8 px apart. Nothing depends on hover: gate hover effects with (hover: hover) and (pointer: fine). Body and input text at least 16 px on phones. Never disable pinch zoom. Keep focus rings visible.
- Phones: shader pixel ratio at most 1.5. Phones run the shader animated at that pixel ratio. The static grained gradient image is only for prefers-reduced-motion, no WebGL, a failed shader load or data-saver, never for screen width alone. ASCII video and animated grain may become a still frame on phones. Dither cells stay 4 CSS px. Sigil at most 40svh tall and 60vw wide, never below 96 px.
- Export sizes: Open Graph 1200x630, LinkedIn banner 1584x396, GitHub social preview 1280x640. Keep text and the sigil in the central safe area. Favicon and app icon use the vector or pixel star, never the live shader.

## Libraries
- Default for materials: Paper Shaders (@paper-design/shaders-react, Apache 2.0, zero dependencies). Pin the version, since breaking changes ship under 0.0.x.
  - Thermal gradient with grain: Grain Gradient or Mesh Gradient, which animate. Static Mesh Gradient and Static Radial Gradient are for stills and fallback images only, never for a hero that must move.
  - Animation: named components default to speed 1, but the low-level ShaderMount defaults to speed 0 (paused). Speed 0 or a fixed frame prop freezes the shader, and a hidden tab pauses it. Prove a hero shader moves by diffing two screenshots taken a couple of seconds apart.
  - Dither: Dithering, Image Dithering. Stipple: Halftone Dots (never Halftone CMYK).
  - Square dot grid: Dot Grid with the square shape. Thermal on images: Heatmap. Paper-like grain: Paper Texture.
  - Iridescent logo or star: Liquid Metal (LiquidMetal component), tinted toward the iridescent band. It is the page's one iridescent object.
- 3D hero only when a flat shader cannot do it: ShaderGradient (@shadergradient/react, MIT) on react-three-fiber (@react-three/fiber, MIT) and three. Match R3F to React (R3F 8 with React 18, R3F 9 with React 19).
- Custom GPU passes such as ASCII over video: vgpu (Vercel Labs, MIT, WebGPU). Experimental, so treat as progressive enhancement.
- Liquid Logo (paper-design/liquid-logo) is a demo of Liquid Metal. Use LiquidMetal from Paper Shaders in production. Check its license before reusing repo code.
- rune (anomalyco/rune) is not part of the web stack. Do not use it unless asked.
- Smooth scroll: Lenis (lenis, MIT) site-wide on desktop, with its recommended lenis.css. Defaults (lerp 0.1, autoRaf on), tune by feel.
  - Do not start it under prefers-reduced-motion. Leave touch scrolling native: no syncTouch.
  - anchors: true so nav and menu links still jump to sections. data-lenis-prevent on the menu sheet and inner scrollers, and stop Lenis while the sheet is open.
  - Destroy on unmount. If GSAP is used, drive Lenis from gsap.ticker so only one animation loop runs. Read the React wrapper docs in the Lenis repo before wiring it in.
  - If a phone stutters, disable Lenis on touch devices first.
- React Bits (DavidHDev/react-bits): copy-in components via shadcn CLI or jsrepo. Pick the TS variant matching the repo's styling, then retheme: tokens instead of default colors, contrast check, reduced-motion branch. Wrap each component once and reuse the wrapper. A React Bits background is the view's full-bleed canvas and replaces the Paper Shaders background, never joins it. Text animations only on the hero title and at most one other element, never body text or every heading. Repo license not confirmed, so check its LICENSE first.
- Vanta (tengbao/vanta): only when an effect is wanted that Paper Shaders cannot do. It adds three.js or p5 and counts as the full-bleed canvas, so never next to another full-bleed shader. Pass system colors, call destroy() on unmount, gyroControls off, not under reduced motion. Dots must be square. Repo license not confirmed, so check its LICENSE first.
- Integration rules:
  - At most two shader canvases per view: one full-bleed background and one small accent canvas for the liquid sigil. A shader gradient is the view's gradient family. If the view needs both a gradient and a dither, make the dither a static baked pattern layer, not a second full-bleed canvas.
  - Pass system tokens into shader color props. Never use ad-hoc colors.
  - Put grain on top of ShaderGradient output.
  - Lazy-load below the fold, cap pixel density, pause off-screen.
  - Reduced motion: speed 0 or a single frame for Paper Shaders, a static grained image instead of ShaderGradient.
  - Text over any shader sits on a plate. Ship a static fallback image for every shader.

## Context
- Portfolio and personal sites: full system.
- Landing page default: one full-bleed Paper Shaders Grain Gradient or Mesh Gradient (never a Static component), with speed above 0, in the thermal ramp, cold on one side and hot at a lower corner, slow motion; a Bayer 4x4 dither fringe with 4 px cells where it meets the surface (static pattern layer); the liquid sigil over the cold part of the field; hero title on a plate wherever it crosses texture, with the lowest measured contrast reported; ASCII over video only if a short clip already exists; static fallback only for reduced motion, no WebGL or a failed shader load, never by screen width. Above the fold: the hero title and primary call to action must be fully visible without scrolling at 1366 by 768 and 375 by 667. Hero height is 100svh, and the sigil is at most 40svh so it never pushes the title down.
- Resume PDF: light, static, star plus one thin dither or stipple accent.
- LinkedIn banner: grained thermal gradient and star, minimal text.
- GitHub: pixel and ASCII star, SVG banner, no video.
- Slides: thermal and grain cover, plain content slides.
