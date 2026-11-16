# ASCII background collection

`AsciiBackground` is a full-viewport selector built on the local `Piece` contract and `Ascii` renderer from `ascii.rest`. It imports pieces as modules, so the browser never fetches a piece by name at runtime. The renderer owns the 12 fps cap, canvas atlas, reduced-motion still frame, `IntersectionObserver` pause, and hidden-tab pause.

## Pieces

| Collection piece | Library source |
| --- | --- |
| `thermal-plasma` | Existing `ascii.rest/pieces/plasma`, recoloured through the collection ramp |
| `aurora-drift` | Existing `ascii.rest/pieces/aurora`, recoloured through the collection ramp |
| `deep-ocean` | Existing `ascii.rest/pieces/galaxy` used as a quiet particle/current field |
| `nebula-clouds` | Existing `ascii.rest/pieces/galaxy`, with the nebula palette |
| `topographic-flow` | Existing `ascii.rest/pieces/contour-map`, with cobalt index contours |
| `lorenz-butterfly` | Existing `ascii.rest/pieces/lorenz`, with the blue-violet trail palette |
| `starry-ridge`, `solar-corona`, `brians-brain`, `edge-orbit` | Local pieces because the package has no sufficiently close, token-compatible piece |

The package also exposes kit recipes such as `plasma`, `aurora`, `galaxy`, `sea`, and `stars`; the published 0.4.0 package's existing pieces were preferred where their motion already matched the requested intent. Existing pieces emit glyph frames, and the collection adapter maps their restrained ramp to the configured palette.

## Adding a piece

1. Add a local module under `pieces/` implementing `Piece` from `ascii.rest`.
2. Keep `meta.cols * meta.rows` below 20,000, use a 4 px-compatible cell grid, and keep `fps` at or below 15.
3. Add the module and its palette to `config.ts`; the selector and demo discover it from `ASCII_PIECES`, so no selection-system change is needed.
4. Add a short mapping note to this README and keep the text plate above the background.
