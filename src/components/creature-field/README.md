# CreatureField

Reusable full-bleed 2D canvas background of animated ASCII creatures on the dark surface (`--ds-color-background`).

## Usage

The parent element must use `position: relative` and `isolation: isolate`. The `<canvas>` renders at `position: absolute; inset: 0` behind foreground content. Text over the field must sit on a `.plate` (`surface` at 85 to 90% opacity) passed into `avoid`.

```tsx
import { useRef } from 'react'
import { CreatureField } from './components/creature-field'

export function SectionWithCreatures() {
  const plateRef = useRef<HTMLDivElement>(null)

  return (
    <section className="relative isolate min-h-dvh overflow-hidden">
      <CreatureField avoid={[plateRef]} />
      <div ref={plateRef} className="plate rounded-md p-6">
        <p className="text-text-primary">Content on a high-contrast plate.</p>
      </div>
    </section>
  )
}
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `species` | `SpeciesId \| 'random'` | `'random'` | Species to render (`'koi'`, `'butterfly'`, `'jellyfish'`, `'dragonfly'`, `'manta'`, `'fish-school'`), or `'random'` to pick on mount without repeating the previous session species. In dev builds, `?creature=<id>` also overrides `'random'`. |
| `pool` | `SpeciesId[]` | All six | Candidate species pool when `species` is `'random'`. |
| `seed` | `number` | `Date.now()` | Deterministic PRNG seed for repeatable runs and automated tests. |
| `count` | `number` | Area formula | Override the viewport-area creature count (`clamp(round(base * area / 1_300_000), min, max)`). |
| `cell` | `number` | `8` | Cell pitch in CSS pixels (snapped to a multiple of 4, minimum 4). |
| `scale` | `number` | `1` | Multiplies creature size in cells without changing the cell size. |
| `avoid` | `RefObject<HTMLElement \| null>[]` | `undefined` | Elements whose bounding boxes emit a repulsion field and clip cells so creatures steer around plates and forms without overlapping text. |
| `clickMode` | `'auto' \| 'scatter'` | `'auto'` | `'auto'` feeds `koi` and scatters all other species; `'scatter'` forces scatter for every species. |
| `interactive` | `boolean` | `true` | Enables window pointer and touch-tap interactions. |
| `paused` | `boolean` | `false` | Pauses the simulation and animation loop when `true`. |
| `grid` | `boolean` | `true` | Renders the cell-aligned square dot grid (`--ds-color-text-secondary` at 12% opacity). |
| `fixed` | `boolean` | `false` | Uses `position: fixed; inset: 0` instead of `position: absolute; inset: 0`. |
| `className` | `string` | `''` | Additional CSS classes applied to the `<canvas>`. |

## Adding a species

Adding a seventh species requires **one new file** and **one list entry**:

1. Create `src/components/creature-field/species/<name>.ts` exporting a `SpeciesDefinition` object:
   - `id`: unique `SpeciesId`
   - `countRange`: `[min, max]` for a 1440x900 viewport
   - `speedRange`: `[min, max]` in CSS px/s at `cell = 8`
   - `defaultClickBehavior`: `'scatter'` or `'feed'`
   - `getRamps(palette)`: array of `ColorRamp` entries from `palette.ts`
   - `spawn(count, width, height, cell, scale, avoidRects, rng)`: initial `Creature[]`
   - `update(creatures, dt, env)`: 60 Hz motion step
   - `renderCreature(creature, cell, scale, time, plotCell)`: procedural cell-space rasterizer calling `plotCell(gx, gy, rampIndex, shade, coverage, glyphHash)`
2. Append the definition to `SPECIES_LIST` in `src/components/creature-field/species/index.ts` (and add its literal ID to `SpeciesId` in `species/types.ts`).

## Performance notes

- **Fixed 60 Hz simulation**: Physics and steering run at a fixed `1 / 60 s` step with `dt` clamped to `100 ms`, decoupled from display refresh rate.
- **Pre-rendered ASCII glyph atlas**: After waiting for `Paper Mono` (`--ds-font-family-mono`) to load, all 13 ASCII brightness glyphs across every species ramp are rendered once into an offscreen sprite sheet (`cellAtlas`) and blitted via `drawImage` per occupied cell, eliminating `fillText` calls from the frame loop.
- **Stable creature-local glyphs**: Each cell's glyph index is hashed from the creature's own `id` and creature-local coordinates (`hashCreatureLocalGlyph`), so characters stay locked to the creature body without shimmering as it moves.
- **Dirty-cell restoration**: After the initial paint (or resize), only the cells occupied during the previous frame are repainted with the cached square-dot grid `CanvasPattern`, avoiding full-screen pixel clears on large Retina viewports.
- **DPR & visibility caps**: `devicePixelRatio` is capped at `2` on desktop and `1.5` on phones. The RAF loop stops automatically when `paused` is `true`, when the tab is hidden (`visibilitychange`), when the canvas is off-screen (`IntersectionObserver`), or under `prefers-reduced-motion: reduce` (which warms up for 3 s and renders one static frame).
