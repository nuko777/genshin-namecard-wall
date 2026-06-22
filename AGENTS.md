# Project: Teyvat Color Spectrum (提瓦特色谱)

A single-page React app for arranging Genshin Impact namecard icons into gradient mosaic patterns.

## Tech Stack

- **React 18** + **Vite 5** + **TypeScript** + **Less**
- **Ant Design 5** for UI components (Modal, Button, Select, Checkbox, Input)
- **html2canvas** for PNG export
- **sharp** + **culori** for color pre-computation (Node.js)

## Project Entry

- `npm run dev` — 启动 Vite 开发服务器（默认 http://localhost:5173），本地开发服务器必须在沙箱外启动，确保原生文件监听和 HMR 正常工作
- `npm run build` — 生产构建
- `npm run preview` — 预览生产构建

## Data Architecture

- **images**: `public/cards/` — 270 PNG files, all square canvases (257×256px / 13×512px) with transparent padding around a ~1.53:1 artwork region
- **namecard config**: `public/namecards.json` — display/search/filter fields plus precomputed color metrics
- **schema** (`Namecard`):
  ```ts
  { name, hash, theme, region, element,
    themeColors: Array<{
      rgb: [R,G,B],             // display-ready sRGB representative color
      hex: string,              // #RRGGBB for UI display/copy
      hsl: [H,S,L],             // [0-360, 0-100, 0-100] for sorting/matching/debugging
      oklch: [L,C,H],           // perceptual color descriptor from culori
      ratio: number             // alpha-weighted visible area ratio [0-1]
    }> }
  ```
- **themes**: region, character, achievement, battlepass, event
- **regions**: 蒙德, 璃月, 稻妻, 须弥, 枫丹, 纳塔, 挪德卡莱, 至冬
- **elements**: 风, 岩, 雷, 草, 水, 火, 冰

### Color Pre-computation (`scripts/calc_theme_colors.cjs`)

Current pipeline:
1. **Bounding-box detection** — find non-transparent pixel extent (excludes ~14px L/R + ~54px T/B transparent padding)
2. **3% uniform inset** — skips the white decorative border on all 4 sides (same px value derived from content width)
3. **Raw RGBA extraction** — uses sharp `ensureAlpha().raw()` so alpha filtering is explicit and format handling stays robust
4. **Hue-bucket aggregation** — converts each visible pixel with culori and groups it into one of 9 hue buckets by HSL hue; low-saturation/low-chroma pixels fall into a single `low-color` neutral bucket so gray/white shadows are not split into pseudo-colors. Each bucket accumulates an alpha-weighted OKLab centroid.
5. **Dominant lightness split** — when a single bucket exceeds 85% of visible weight, attempt to split it along OKLab lightness into a dark/light pair (each side must keep ratio > `MIN_THEME_RATIO` and differ enough in lightness)
6. **Theme color formatting** — keeps buckets above the minimum ratio, sorts by alpha-weighted visible area ratio, takes the top 4, and writes `rgb`, `hex`, `hsl`, `oklch`, and `ratio`

`themeColors[0]` is the primary display/sorting color. Empty `themeColors` means the image was missing, unreadable, transparent, or no cluster met the minimum visible-area threshold.

## Component Structure

```
src/
  main.tsx                    # ConfigProvider (white theme, #1890ff primary)
  App.tsx / App.less          # root layout (header + 50/50 two-column main)
  types/index.ts              # Namecard, FilterState, GradientPreset, GradientDirection
  hooks/
    useNamecards.ts           # fetch namecards/colors JSON (AbortController), filter + search
    useDisabled.ts            # localStorage persistence for disabled namecards
    usePreview.ts             # 16-slot preview grid state (drop/swap/fill/remove)
    useGradient.ts            # color picker + 6 mid-low-saturation presets + matching dispatch; picker color changes are debounced (250ms) before regenerating, presets/fill-endpoints commit immediately
  components/
    NamecardWall/
      index.tsx               # wall container + sticky header + filter bar
      FilterBar.tsx           # search (200ms debounce) + theme/region/element selects + hide-disabled
      NamecardItem.tsx        # square thumbnail (React.memo, draggable, right-click toggle)
    Preview/
      index.tsx               # preview panel (gradient + grid + actions)
      PreviewGrid.tsx         # 4×4 grid, shared didDropRef for drag coordination
      PreviewSlot.tsx         # draggable slot — swap on drop, delete on drag-out
      GradientPanel.tsx       # color pickers, direction + fill-mode switches, 6 presets (auto-regenerates on change)
      ActionButtons.tsx       # clear / save PNG / copy layout / import layout
    Modal/
      NamecardDetail.tsx      # antd Modal with card detail + disable toggle
  utils/
    color.ts                  # color primitives + metrics: hexToRGB, hslColor, rgbToHslColor, hue/hslDistance (+ HSL_DISTANCE_WEIGHTS)
    grid.ts                   # grid geometry consts (GRID/TOTAL/DIAGONAL_COUNT) + getSlotWeight + NEIGHBOR_PAIRS
    targets.ts                # gradient target colors: TARGET_INTERPOLATION_GAMMA + computeTargets
    themeColors.ts            # theme-color candidate prep, best-match theme distance
    gradient.ts               # solveDiagonalMatching (HSL targets + direct quality-driven hill-climb + restarts)
    layout.ts                 # clipboard layout serialize/parse
    export.ts                 # html2canvas wrapper (2x scale, #fafafa bg)
```

## Core Algorithms

### Gradient + Quality-Driven Matching (`gradient.ts`)

1. User picks 2 colors + direction (tl→br or tr→bl)
2. 4×4 grid is grouped into 7 diagonals with sizes `1-2-3-4-3-2-1`
3. 7 target colors are computed in HSL with S/L interpolation and shortest-path hue; interpolation uses symmetric gamma `1.25` so mid-diagonals stay closer to endpoint character in weak/generalized scenes
4. The generator **directly maximizes the `matching-score.cjs` quality score** (no proxy cost, no pure-color pool, no Hungarian assignment). Each candidate is precomputed once: per-diagonal best-theme distance `gd[w]`, primary HSL, primary OKLCH, and a single-card purity penalty — all derived from existing `themeColors`.
5. `quality(grid)` mirrors the scorer exactly: `100 + W_MONO·hueAnchor − W_GRADIENT·gradientDelta − W_NEIGHBOR·neighborSmooth − W_DIAG_COHESION·diagCohesion − W_DIAG_HUE·(diagHueSpread/90) − W_PURITY·purityPenalty`. `hueAnchor` is the mean absolute hue deviation between each cell's primary and its diagonal target, normalized to [-1,1] (deviation 0°→1, ≥180°→-1) — absolute anchoring, not a Pearson correlation, so a uniformly hue-shifted layout can't game the reward
6. Greedy init places, per diagonal-weight order, the unused card with smallest `gd` for that diagonal; locked slots (fill mode) are pinned and excluded from the pool
7. Hill-climbing recombination: best-improving move among (a) swap two free slots, (b) replace a free slot with a pooled card, repeated until no gain (≤400 iters). Locked slots never move
8. Deterministic random restarts (×8, mulberry32 seed) keep the best grid; rescues weak-coverage color pairs from local optima. Offline `matching-generate.cjs` uses the identical optimizer (tl-br, no locks) and produces grid-identical output

#### Tunable parameters

`gradient.ts` quality weights — these MUST stay identical to `matching-score.cjs` (changing them changes the objective the generator optimizes):

| Param | Value | Role | Increase → |
|---|---|---|---|
| `W_MONO` | 40 | hue-anchor reward (only reward term) | tighter absolute hue match to target |
| `W_GRADIENT` | 50 | per-cell target fit penalty | tighter target fidelity |
| `W_NEIGHBOR` | 22 | neighbor primary-color distance penalty | smoother transitions |
| `W_DIAG_COHESION` | 30 | same-diagonal primary-color spread penalty | tighter diagonal clustering |
| `W_DIAG_HUE` | 20 | same-diagonal OKLCH hue spread penalty (÷90 normalized) | more consistent diagonal hue |
| `W_PURITY` | 16 | per-card purity penalty | prefers purer cards |
| `MASS_PENALTY_WEIGHT` | 0.035 | theme-mass term inside best-theme distance | favors higher-ratio matched themes |

Optimizer: `RESTARTS` `8`, `HILL_ITERATIONS` `400`, `RNG_SEED` `0x9e3779b9`. Others: target interpolation gamma `1.25` in `targets.ts`; 6 preset endpoint colors live in `hooks/useGradient.ts`; preprocessing params live in `scripts/calc_theme_colors.cjs` and require regenerating `namecards.json` after changes.

### Gradient Presets (6)

6 presets pairing adjacent hues every 60° around the HSL wheel at mid-low saturation (S≈45%, L≈62%), with literary names: 朝霞流金 (red→yellow H0→H60), 金穗新蕖 (yellow→green H60→H120), 林深见海 (green→cyan H120→H180), 碧波映天 (cyan→blue H180→H240), 暮云凝紫 (blue→magenta H240→H300), 紫霞酡红 (magenta→red H300→H360).

### Disabled Namecards

- Stored in localStorage key `genshin_namewall_disabled` as array of hashes
- Toggle via right-click on thumbnail or modal button
- Disabled cards grayed out (opacity + grayscale), excluded from matching and display (when hideDisabled checked)

### Fill Mode

- Toggle switch in `GradientPanel` (next to direction switch); state held in `App.tsx` (`fillMode`)
- When on, dropping a wall card with valid `themeColors` onto the gradient **start corner** (`getSlotWeight===0`) or **end corner** (`getSlotWeight===6`) sets that end's color (`color1`/`color2`) to the card's highest-ratio theme color, records an endpoint lock for that physical slot, and regenerates the whole grid with that hash fixed in place
- Start/end corners follow direction automatically via `getSlotWeight(index, direction)` (tl-br: slot0/slot15; tr-bl: slot3/slot12), no per-corner branching
- Endpoint locks are filtered against the current valid candidate hash set before each auto-regeneration; disabled cards, battlepass-off cards, missing/invalid color data, and direction-mismatched endpoints are dropped instead of bypassing the candidate pool. Assignment excludes locked hashes from the free pool, and local search skips swaps involving locked slots. Manual color changes, preset changes, direction changes, turning fill mode off, or clearing preview clear endpoint locks.
- Wired in `App.tsx` `handleDrop`; non-corner drops and the off state keep plain placement behavior

### Clipboard Layout

- 预览布局可以复制到剪贴板，格式为紧凑的序列化 hash 列表，也可以稍后从剪贴板恢复。
- 导入时会校验 hash 是否存在于当前候选集，跳过不可用名片，保留槽位位置，并清除端点锁定，因为恢复布局按手动编排处理。

## Layout

- **White theme**: #f0f2f5 / #fff background, #1890ff light blue accent
- **Desktop 50/50 equal columns**: CSS Grid `1fr 1fr` — both panels same width
- **Mobile layout**: `max-width: 900px` switches to single-column document flow; preview panel is ordered above the namecard wall, and the wall grid drops to 3 columns (2 columns below 560px)
- **Scrolling**: desktop uses `.app__left` / `.app__right` panel-level scrolling; mobile uses document-flow page scrolling without nested wall-grid scroll
- **Header**: fixed at app top; section headers are normal in-panel content
- **Cards**: 1:1 square aspect ratio, 4-column `1fr` grid on both sides
- **ConfigProvider**: antd default light theme, colorPrimary #1890ff

## TODO

- [ ] **筛选功能完善** — 当前 theme/region/element 字段在 `public/namecards.json` 中多数为空，筛选暂不完整，待数据补全后启用
- [x] **移动端适配** — 响应式断点：小屏单列布局，预览在上、名片墙在下，卡片网格从 4 列降为 3→2 列

## Image Source

https://wiki.bittopup.com/zh-CN/genshin/namecards

米哈游/HoYoverse — personal use only
