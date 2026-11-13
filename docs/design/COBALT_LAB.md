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
- Use it as marker, bullet, section break or signature. Never as decoration. Two or fewer per screen.

### Liquid sigil (liquid metal merged with iridescence)
- A liquid-metal render of the star whose stripes split into the iridescent pastels at the edges. It replaces the separate iridescent shape: one per page, and no other iridescent element.
- Use: landing hero (live, 240 to 480 px) and personal logo at hero scale or social images (exported still frame). Proposal for the logo: star plus the name in Founders Grotesk, only the star is liquid.
- Never use the live shader below 96 px. Nav, favicon, bullets and section breaks use the vector or pixel star. Resume PDF uses the solid vector star. Loader finished state uses the thermal star.
- Implementation: LiquidMetal from @paper-design/shaders-react, with the star as a transparent-background SVG or PNG mask. Do not use the built-in shapes.
- Start values (tune against the page background, keep them in one named constant): colorBack #14161A, colorTint #B9A6F0, shiftRed 0.3, shiftBlue 0.3, repetition 2, softness 0.1, distortion 0.07, contour 0.4, angle 70, scale 0.6, speed 0.4, fit contain.
- Cap pixel ratio (minPixelRatio, maxPixelCount). Place it over the cold end of the thermal field or on a plain dark plate, never over the hot end.
- Static fallback: vector star with the four-pastel iridescent gradient. Use it for reduced motion, no WebGL, off-screen and print.
- Decorative by default (aria-hidden). If it is the logo, give it a text label.
- No sparkle on hover. Sparkle only on the final call-to-action click.
- Own marks only. Never apply it to third-party logos.

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

## Libraries
- Default for materials: Paper Shaders (@paper-design/shaders-react, Apache 2.0, zero dependencies). Pin the version, since breaking changes ship under 0.0.x.
  - Thermal gradient with grain: Grain Gradient, Static Mesh Gradient, Mesh Gradient.
  - Dither: Dithering, Image Dithering. Stipple: Halftone Dots (never Halftone CMYK).
  - Square dot grid: Dot Grid with the square shape. Thermal on images: Heatmap. Paper-like grain: Paper Texture.
  - Iridescent logo or star: Liquid Metal (LiquidMetal component), tinted toward the iridescent band. It is the page's one iridescent object.
- 3D hero only when a flat shader cannot do it: ShaderGradient (@shadergradient/react, MIT) on react-three-fiber (@react-three/fiber, MIT) and three. Match R3F to React (R3F 8 with React 18, R3F 9 with React 19).
- Custom GPU passes such as ASCII over video: vgpu (Vercel Labs, MIT, WebGPU). Experimental, so treat as progressive enhancement.
- Liquid Logo (paper-design/liquid-logo) is a demo of Liquid Metal. Use LiquidMetal from Paper Shaders in production. Check its license before reusing repo code.
- rune (anomalyco/rune) is not part of the web stack. Do not use it unless asked.
- Integration rules:
  - At most two shader canvases per view: one full-bleed background and one small accent canvas for the liquid sigil. A shader gradient is the view's gradient family. If the view needs both a gradient and a dither, make the dither a static baked pattern layer, not a second full-bleed canvas.
  - Pass system tokens into shader color props. Never use ad-hoc colors.
  - Put grain on top of ShaderGradient output.
  - Lazy-load below the fold, cap pixel density, pause off-screen.
  - Reduced motion: speed 0 or a single frame for Paper Shaders, a static grained image instead of ShaderGradient.
  - Text over any shader sits on a plate. Ship a static fallback image for every shader.

## Context
- Portfolio and personal sites: full system.
- Landing page default: one full-bleed Paper Shaders Grain Gradient (or Static Mesh Gradient) in the thermal ramp, cold on one side and hot at a lower corner, slow motion; a Bayer 4x4 dither fringe with 4 px cells where it meets the surface (static pattern layer); the liquid sigil over the cold part of the field; hero title on a plate wherever it crosses texture, with the lowest measured contrast reported; ASCII over video only if a short clip already exists; static fallback for reduced motion, small screens and no WebGL.
- Resume PDF: light, static, star plus one thin dither or stipple accent.
- LinkedIn banner: grained thermal gradient and star, minimal text.
- GitHub: pixel and ASCII star, SVG banner, no video.
- Slides: thermal and grain cover, plain content slides.
