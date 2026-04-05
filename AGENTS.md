# Project: Genshin Namecard Wall (原神名片墙)

A single-page React app for arranging Genshin Impact namecard icons into gradient mosaic patterns.

## Tech Stack

- **React 18** + **Vite 5** + **TypeScript** + **Less**
- **Ant Design 5** for UI components (Modal, Button, Select, Checkbox, Input)
- **html2canvas** for PNG export
- **pngjs** for color pre-computation (Node.js)

## Project Entry

- `npm run dev` — start Vite dev server (default: http://localhost:5173)
- `npm run build` — production build
- `npm run preview` — preview production build

## Data Architecture

- **images**: `public/cards/` — 270 PNG files, all square canvases (257×256px / 13×512px) with transparent padding around a ~1.53:1 artwork region
- **config**: `public/data.json` — copy of `data/namecards.json`
- **json schema** (`Namecard`):
  ```ts
  { name, hash, theme, region, element,
    avgColor: [R,G,B],          // overall average (mean of 6 zones)
    zones: [[R,G,B]×6],         // 6 zone colors, 3×2 row-major
    variance: number,           // mean colorDistance from each zone to overall avg
    description, obtainMethod }
  ```
- **themes**: character, achievement, region, event, other
- **regions**: 蒙德, 璃月, 稻妻, 须弥, 枫丹, 纳塔, 至冬, 其他
- **elements**: 风, 岩, 雷, 草, 水, 火, 冰

### Color Pre-computation (`scripts/calc_avg_colors.cjs`)

Three-stage pipeline:
1. **Bounding-box detection** — find non-transparent pixel extent (excludes ~14px L/R + ~54px T/B transparent padding)
2. **3% uniform inset** — skips the white decorative border on all 4 sides (same px value derived from content width)
3. **3×2 zone grid** — divides remaining area into 6 equal zones, computes per-zone alpha-premultiplied avg RGB

`variance` = mean perceptually-weighted color distance from each zone to the overall average. Lower = more uniform = preferred in matching.

## Component Structure

```
src/
  main.tsx                    # ConfigProvider (white theme, #1890ff primary)
  App.tsx / App.less          # root layout (header + 50/50 two-column main)
  types/index.ts              # Namecard, FilterState, GradientPreset, GradientDirection
  hooks/
    useNamecards.ts           # fetch /data.json (AbortController), filter + search
    useDisabled.ts            # localStorage persistence for disabled namecards
    usePreview.ts             # 16-slot preview grid state (drop/swap/fill/remove)
    useGradient.ts            # color picker + 29 presets + matching dispatch
  components/
    NamecardWall/
      index.tsx               # wall container + sticky header + filter bar
      FilterBar.tsx           # search (200ms debounce) + theme/region/element selects + hide-disabled
      NamecardItem.tsx        # square thumbnail (React.memo, draggable, right-click toggle)
    Preview/
      index.tsx               # preview panel (gradient + grid + actions)
      PreviewGrid.tsx         # 4×4 grid, shared didDropRef for drag coordination
      PreviewSlot.tsx         # draggable slot — swap on drop, delete on drag-out
      GradientPanel.tsx       # color pickers, direction, 29 presets, generate button
      ActionButtons.tsx       # clear / download PNG
    Modal/
      NamecardDetail.tsx      # antd Modal with card detail + disable toggle
  utils/
    color.ts                  # hexToRGB (#RGB→#RRGGBB), interpolateRGB, colorDistance (R×2,G×4,B×3)
    gradient.ts               # generateTargetColors, solveMinimumCostMatching (neighbor-aware)
    export.ts                 # html2canvas wrapper (2x scale, #fafafa bg)
```

## Core Algorithms

### Gradient + Neighbor-Aware Matching (`gradient.ts`)

1. User picks 2 colors + direction (tl→br or tr→bl)
2. 16 target RGBs computed via linear interpolation along the diagonal
3. **Greedy row-major assignment** with 3 **normalized** cost factors:
   - **Gradient fit** (×1.0): `colorDistance(target, avgColor) / 160`
   - **Variance penalty** (×1.2): `variance / 50` — uniform cards preferred
   - **Neighbor edge matching** (×1.0): averaged zone edge distances / 160
   - Normalizers derived from dataset statistics (p50 values)
4. **2-opt swap improvement** — pairwise swaps (max 200 iterations) checking all 4 neighbor directions

### Zone Layout (3×2)

```
┌───┬───┬───┐
│ 0 │ 1 │ 2 │  top row
├───┼───┼───┤
│ 3 │ 4 │ 5 │  bottom row
└───┴───┴───┘
```

- Vertical edge: above[3,4,5] ↔ current[0,1,2]
- Horizontal edge: left[2,5] ↔ current[0,3]

### Gradient Presets (29)

7 Genshin elemental themes (high saturation) + 22 popular web gradients.

### Disabled Namecards

- Stored in localStorage key `genshin_namewall_disabled` as array of hashes
- Toggle via right-click on thumbnail or modal button
- Disabled cards grayed out (opacity + grayscale), excluded from matching and display (when hideDisabled checked)

## Layout

- **White theme**: #f0f2f5 / #fff background, #1890ff light blue accent
- **50/50 equal columns**: CSS Grid `1fr 1fr` — both panels same width
- **Scrolling**: at `.app__left` / `.app__right` level (panel-level, not nested)
- **Header**: sticky inside scrollable panel
- **Cards**: 1:1 square aspect ratio, 4-column `1fr` grid on both sides
- **ConfigProvider**: antd default light theme, colorPrimary #1890ff

## TODO

- [ ] **筛选功能完善** — 当前 theme/region/element 字段在 data.json 中多数为空，筛选暂不完整，待数据补全后启用
- [ ] **移动端适配** — 响应式断点：小屏单列布局，卡片网格从 4 列降为 3→2 列

## Image Source

https://wiki.bittopup.com/zh-CN/genshin/namecards

米哈游/HoYoverse — personal use only
