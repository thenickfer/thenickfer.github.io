# Design decisions

Format: `YYYY-MM-DD — rule bent — reason`

- `2026-11-13 — LiquidSigil & GrainGradient shader tuning — Tuned LiquidSigil named constant (scale 0.97 to match the 70% pre-padded SVG mask and eliminate the oversized 40% fallback border overhang, shiftRed/shiftBlue 0.5 and repetition 3 / softness 0.06 / contour 0.18 for a thinner, more iridescent border, 512px PNG mask rasterization to avoid 4096px SVG CPU stall) and GrainGradient (speed 0.78 to compensate for shader 0.1x time multiplier, maxPixelCount capped at 640k desktop / 320k phone to eliminate fragment lag).`
