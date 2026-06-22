# 渐变匹配核心结论

本文只保留离线实验沉淀后的可执行结论、评分口径和人工基准。历史推演、任务说明、过期脚本分支和长表已删除。

## 当前生产口径

- 数据源：`public/namecards.json` 的 `themeColors`，每项含 `rgb`、`hex`、`hsl`、`oklch`、`ratio`，按 alpha 加权可见面积 `ratio` 从高到低排列。
- 主题色预处理：`scripts/calc_theme_colors.cjs` 读取 `public/cards/`，先在内容 bounding box 内做 3% 内缩，再按 9 段 hue 分桶聚合像素（低饱和/低色度像素并入 `low-color` 中性桶，避免灰白阴影被拆成伪彩色）；当单一主色占比超过 0.85 时，进一步按 OKLab 明度尝试拆分为深浅两色；最终按 `ratio` 取前 4 个主题色输出。
- 前端匹配：`src/utils/gradient.ts` 以 HSL 生成 7 条对角线目标色（端点插值使用对称 gamma `1.25`，中段更靠近端点性格），随后**直接以 `matching-score.cjs` 的 quality 为目标函数**生成 4x4 排布：预计算每卡评分相关量 → 贪心初始化（按对角线权重选目标距离最小卡）→ 爬山重组（交换两格 + 用池中卡替换某格，直接最大化 quality）→ 随机重启取最优。评分用到的主色 HSL / OKLCH / 杂色值全部来自现有 `themeColors`，无需额外预处理。
- 离线脚本：`matching-score.cjs` 提供 hash 无关的独立质量评分（不再做人工目标拟合度打分）；`matching-generate.cjs` 直接复用前端 `src/utils/gradient.ts` 的 `solveDiagonalMatching`（同一优化器，仅负责 CLI/候选加载/输出，不重复算法实现），保证线上线下逐位一致；两者通过 `docs/specs/utils/load-ts-utils.cjs` 引用 `src/utils/` 下的工具。生成器的 quality 口径与权重必须与评分脚本逐位一致。
- 评分对齐：`src/utils/targets.ts` 的 `computeTargets` 复刻同一 gamma `1.25` 插值曲线，确保评分脚本的 `gradientDelta` / `quality` 与前端实际渲染口径一致。
- 填充模式端点：端点槽只作为 hash 占位；端点名片用于更新起止颜色，不参与颜色匹配评分。

## 颜色空间结论

- RGB 只适合作为展示输出，不适合作为聚类或匹配距离空间。
- HSL 可解释性强，适合前端排序、调试和轻量匹配，但不是感知均匀空间。
- OKLab / OKLCH 更适合主题色聚类和感知距离判断。
- 当前最稳妥的长期结构是：

```txt
聚类：OKLab
解释：OKLCH + HSL
展示：RGB / Hex
权重：alpha 加权可见面积 ratio
```

## 基准排布（校准夹具）

三组人工排布不再用于「拟合度打分」，只作为独立质量口径的校准夹具：用同一套 hash 无关指标回测，验证该口径会给人工排布高分（`--reference`）。任何情况下都不允许进入生成逻辑。

```txt
基准1 青绿->蓝紫
start=#83c0b5 end=#8fa0cf direction=tl-br
b3f876e 7894471 0bc52ec 7edf111
4fcc37a 21c383e 4d9ea4e 8e839d5
d1e79fc b618dcd b68b388 4bed3bc
7b69235 4a921c0 87e0192 d95ad5c

基准2 黄绿->青绿
start=#96b16c end=#70adc3 direction=tl-br
c98cef6 bf975e3 13f7a38 4fcc37a
0b196ad bc586e7 d1e79fc 2bffaae
f2a2b9a b3f876e 0bc52ec 690e49e
7894471 21c383e 3debf97 0772c89

基准3 紫->蓝
start=#aeaae4 end=#688ecc direction=tl-br
1a923de 911666e a4bf76e be0ee10
424b985 0b88110 52c633f 381946d
aad6c00 a3e3b77 d95ad5c 9b163b8
05021b7 46122df a9230a2 444a14f
```

### 从基准学到的内在规律

对三组基准 vs 随机布局（同集合重排 / 全量随机抽 16）逐项测量后，以下 hash 无关指标能稳定区分好坏排布：

| 规律 | 基准 | baseline | 随机重排 | 随机抽16 |
|---|---|---|---|---|
| 色相锚定 `hueAnchor` | 高 | 中高 | ~0 | 负 |
| 梯度贴合 `gradientDelta` | 0.07~0.13 | 0.07~0.08 | 0.11~0.13 | 0.23~0.26 |
| 邻居平滑 `neighborSmooth` | 0.09~0.17 | 0.06~0.08 | 0.12~0.17 | ~0.28 |
| 对角线内聚 `diagCohesion` | 0.07~0.12 | 0.07~0.09 | 0.12~0.17 | ~0.28 |
| 对角线色相散度 `diagHueSpread` | 10~12 | 19~23 | 20~41 | ~88 |

`hueAnchor`（每格主色绝对贴合该格目标色）是最显著的判别信号，也是唯一奖励项。早期版本曾用「色相单调性」皮尔逊相关系数，但相关系数对色相整体平移/缩放不变，导致「整体偏色但仍单调」的布局也能拿满分（如柯莱·豹蔚→成就·强弓 的填充场景第二对角线被匹配成黄棕）；改为绝对色相锚定后该漏洞消除。明度单调性在三组基准里符号不稳定（基准1/2 为负、基准3 为正），故不纳入评分。

## 评分算法

评分脚本保留在 [matching-score.cjs](./matching-score.cjs)，离线生成脚本保留在 [matching-generate.cjs](./matching-generate.cjs)（复用 `src/utils/gradient.ts`），公共工具按职责拆在 [src/utils](../../src/utils)。

评分完全独立于人工基准 hash，对任意 16 格布局直接计算质量分（适用于全部场景，不再区分「拟合分」和「泛化分」）：

```txt
quality =
  100 +
  hueAnchor        * 40 -
  gradientDelta    * 50 -
  neighborSmooth   * 22 -
  diagCohesion     * 30 -
  (diagHueSpread / 90) * 20 -
  purityPenalty    * 16
```

指标含义：

- `hueAnchor`：每格主色与该格对角线目标色的平均绝对色相偏差归一为 `[-1,1]`（偏差 0° → 1，>=180° → -1），评分中作为唯一奖励项；用绝对偏差而非相关系数，避免整体偏色骗分。
- `gradientDelta`：每格主色到所在对角线目标色的加权距离均值。
- `neighborSmooth`：相邻格主色 HSL 距离均值。
- `diagCohesion`：同对角线主色两两 HSL 距离均值。
- `diagHueSpread`：同对角线高彩度主色相差均值（OKLCH hue，彩度门控 `0.04`）。
- `purityPenalty`：基于主题色占比、色相熵和簇间跳变的单卡杂色惩罚均值。

权重由「基准 vs 随机 vs badcase」校准得到（绝对锚定口径下基准约 110~118、预设生成约 109~129、随机显著更低），区分度清晰且不会被整体偏色骗分。

### 用法

```txt
node docs/specs/matching-score.cjs --reference
node docs/specs/matching-score.cjs --presets
node docs/specs/matching-score.cjs --clipboard <TVT1:...> --start <hex> --end <hex>
```

`--reference` 用同一口径回测三组基准；`--presets` 对 6 个前端预设方案（与 `src/hooks/useGradient.ts` 一致，沿色相环每 60° 一对、中低饱和）逐一调用 `matching-generate.cjs` 生成布局再评分，作为泛化评估；`--clipboard` 对任意布局打分，输入统一为 `matching-generate.cjs` 输出的 clipboard 文本（需给出起止色生成对角线目标色，方向固定 tl-br）。

## 后续维护规则

- 新算法先通过 `matching-generate.cjs` 生成 16 格 clipboard 布局，再通过 `matching-score.cjs --clipboard` 用独立质量分评价；调权重后用 `--reference` 确认仍偏好三组基准，用 `--presets` 确认 6 个前端预设的泛化质量不退化。
- 评分脚本不得读取或调用前端运行时状态，评分指标必须 hash 无关（不得命中人工目标 hash/集合/邻接）。
- 生成逻辑不得读取人工目标 hash、名称、槽位颜色。
- 生成器与评分的 quality 计算必须逐位一致：`src/utils/gradient.ts`（离线 `matching-generate.cjs` 直接复用它）与 `matching-score.cjs` 两处，改评分公式/权重时两处需同步。
- 前端与离线生成结果在无锁 tl-br 场景下逐格一致（同一份 `gradient.ts` 优化器 + 确定性随机重启）。
- 新增离线生成变种应复用 `src/utils` 中的稳定工具，避免复制颜色转换、目标色、距离和布局序列化逻辑。
- 新增结论只写可迁移规则，不保留大段一次性日志和搜索输出。
