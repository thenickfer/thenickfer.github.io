## Design validation (required)
Any change to UI, styles, user-facing copy, animation, imagery or assets must be validated against `docs/design/COBALT_LAB.md`.
- Read it before you start.
- Use the tokens file. Never hardcode colors, radii, spacing, durations or easing.
- Before you finish, check: palette and fonts, text contrast measured on the worst pixel behind the text, the nested-radius formula, the material budget (one gradient family, one extra texture besides grain, one hero element), the canvas budget, reuse of existing components, loading, empty, error and success states, motion tokens and a reduced-motion branch, star count (two or fewer) and oxide count (one at most).
- End your final message and any PR description with a "Design check" block: each item marked pass, fail or not applicable, with a one-line reason. Fix failures before finishing.
- If a rule has to be bent, record why in `docs/design/DECISIONS.md`.
- If a request conflicts with the rules, say so and ask. Do not silently pick one.
