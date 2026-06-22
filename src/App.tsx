import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { message } from 'antd';
import './App.less';
import type { Namecard, GradientDirection, GradientPreset } from './types';
import type { Candidate, LockedSlots } from './utils/gradient';
import NamecardWall from './components/NamecardWall';
import Preview from './components/Preview';
import NamecardDetail from './components/Modal/NamecardDetail';
import { TOTAL, getSlotWeight } from './utils/grid';
import { hasThemeColors, primaryTheme } from './utils/themeColors';
import { serializeLayout, parseLayout } from './utils/layout';
import { useNamecards } from './hooks/useNamecards';
import { useDisabled } from './hooks/useDisabled';
import { usePreview } from './hooks/usePreview';
import { useGradient } from './hooks/useGradient';

function compareByThemeColor(a: Namecard | undefined, b: Namecard | undefined): number {
  const themeA = primaryTheme(a);
  const themeB = primaryTheme(b);
  if (!themeA && !themeB) return (a?.hash ?? '').localeCompare(b?.hash ?? '');
  if (!themeA) return 1;
  if (!themeB) return -1;

  const [hueA, saturationA, lightnessA] = themeA.hsl;
  const [hueB, saturationB, lightnessB] = themeB.hsl;

  // 低饱和名片缺少明确色相，统一排在彩色名片之后，再按亮度渐变。
  const hueRankA = saturationA < 12 ? 360 : hueA;
  const hueRankB = saturationB < 12 ? 360 : hueB;

  return (
    hueRankA - hueRankB ||
    lightnessA - lightnessB ||
    saturationB - saturationA ||
    themeB.ratio - themeA.ratio
  );
}

function endpointLocksForDirection(locks: LockedSlots, direction: GradientDirection): LockedSlots {
  const next: LockedSlots = {};
  for (let slot = 0; slot < TOTAL; slot++) {
    const weight = getSlotWeight(slot, direction);
    if ((weight === 0 || weight === 6) && locks[slot]) {
      next[slot] = locks[slot];
    }
  }
  return next;
}

function withEndpointLock(locks: LockedSlots, index: number, hash: string, direction: GradientDirection): LockedSlots {
  const next = endpointLocksForDirection(locks, direction);
  for (const [slot, lockedHash] of Object.entries(next)) {
    if (Number(slot) !== index && lockedHash === hash) delete next[Number(slot)];
  }
  next[index] = hash;
  return next;
}

function filterEndpointLocks(locks: LockedSlots, direction: GradientDirection, candidateHashes: Set<string>): LockedSlots {
  const endpointLocks = endpointLocksForDirection(locks, direction);
  const next: LockedSlots = {};
  for (const [slot, hash] of Object.entries(endpointLocks)) {
    if (hash && candidateHashes.has(hash)) next[Number(slot)] = hash;
  }
  return next;
}

function sameLocks(a: LockedSlots, b: LockedSlots): boolean {
  const aEntries = Object.entries(a).filter(([, hash]) => Boolean(hash));
  const bEntries = Object.entries(b).filter(([, hash]) => Boolean(hash));
  if (aEntries.length !== bEntries.length) return false;
  return aEntries.every(([slot, hash]) => b[Number(slot)] === hash);
}

/** 判断槽位是否为当前方向的渐变起点或终点。 */
function isEndpointSlot(index: number, direction: GradientDirection): boolean {
  const weight = getSlotWeight(index, direction);
  return weight === 0 || weight === 6;
}

export default function App() {
  const { namecards, colorMap, filteredNamecards, matchPool, loading, filter, updateFilter } = useNamecards();
  const { disabledSet, toggle: toggleDisabled } = useDisabled();
  const { slots, dropIntoSlot, swapSlots, fillSlots, clearSlots, removeSlot } = usePreview();
  const {
    color1,
    color2,
    direction,
    presets,
    changeColor1,
    changeColor2,
    commitColor1,
    commitColor2,
    setDirection,
    generate,
    applyPreset,
  } = useGradient();

  const [modalHash, setModalHash] = useState<string | null>(null);
  // 填充模式：拖名片到起止角时，把该角的渐变色赋为名片主题色并整盘重排。
  const [fillMode, setFillMode] = useState(false);
  const endpointLocksRef = useRef<LockedSlots>({});
  const [endpointLockVersion, setEndpointLockVersion] = useState(0);

  // 应用隐藏禁用筛选，再按主题色排序；没有主题色数据的名片排在最后。
  const displayedNamecards = useMemo(() => {
    return filteredNamecards
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => !filter.hideDisabled || !disabledSet.has(card.hash))
      .sort((a, b) => {
        const aDisabled = disabledSet.has(a.card.hash);
        const bDisabled = disabledSet.has(b.card.hash);
        if (aDisabled !== bDisabled) return aDisabled ? 1 : -1;

        return (
          compareByThemeColor(colorMap.get(a.card.hash), colorMap.get(b.card.hash)) ||
          a.index - b.index
        );
      })
      .map(({ card }) => card);
  }, [filteredNamecards, filter.hideDisabled, disabledSet, colorMap]);

  // 匹配池只受纪行开关和禁用状态影响，不随左侧搜索/分类变化，避免预览整盘洗牌。
  const candidates = useMemo<Candidate[]>(() =>
    matchPool
      .filter(card => !disabledSet.has(card.hash))
      .filter(hasThemeColors),
    [matchPool, disabledSet]
  );

  const candidateHashSet = useMemo(() => new Set(candidates.map(c => c.hash)), [candidates]);

  const selectedCard = modalHash ? colorMap.get(modalHash) ?? null : null;

  const clearEndpointLocks = useCallback((notify = true) => {
    // 已无锁定时不必触发重排，避免去抖期间被无谓唤醒
    if (Object.keys(endpointLocksRef.current).length === 0) return;
    endpointLocksRef.current = {};
    if (notify) setEndpointLockVersion(v => v + 1);
  }, []);

  /** 更新端点占位名片，并把对应起止色同步为该名片主主题色。 */
  const setEndpointCard = useCallback((index: number, hash: string) => {
    const theme = primaryTheme(colorMap.get(hash));
    if (!theme || !candidateHashSet.has(hash) || !isEndpointSlot(index, direction)) return false;

    endpointLocksRef.current = withEndpointLock(endpointLocksRef.current, index, hash, direction);
    setEndpointLockVersion(v => v + 1);
    if (getSlotWeight(index, direction) === 0) commitColor1(theme.hex);
    else commitColor2(theme.hex);
    return true;
  }, [candidateHashSet, colorMap, direction, commitColor1, commitColor2]);

  const handleDrop = useCallback(
    (index: number, hash: string) => {
      if (!colorMap.has(hash)) return;

      if (fillMode && isEndpointSlot(index, direction)) {
        setEndpointCard(index, hash);
        return;
      }

      dropIntoSlot(index, hash);
    },
    [colorMap, fillMode, direction, setEndpointCard, dropIntoSlot]
  );

  useEffect(() => {
    if (candidates.length === 0) {
      if (Object.keys(endpointLocksRef.current).length > 0) endpointLocksRef.current = {};
      fillSlots(Array(16).fill(null));
      return;
    }

    const lockedSlots = fillMode ? filterEndpointLocks(endpointLocksRef.current, direction, candidateHashSet) : {};
    if (!sameLocks(endpointLocksRef.current, lockedSlots)) endpointLocksRef.current = lockedSlots;
    fillSlots(generate(candidates, lockedSlots));
  }, [candidates, candidateHashSet, direction, endpointLockVersion, fillMode, generate, fillSlots]);

  const handleColor1Change = useCallback((color: string) => {
    if (fillMode) return;
    clearEndpointLocks();
    changeColor1(color);
  }, [clearEndpointLocks, fillMode, changeColor1]);

  const handleColor2Change = useCallback((color: string) => {
    if (fillMode) return;
    clearEndpointLocks();
    changeColor2(color);
  }, [clearEndpointLocks, fillMode, changeColor2]);

  const handleDirectionChange = useCallback((nextDirection: GradientDirection) => {
    clearEndpointLocks();
    setDirection(nextDirection);
  }, [clearEndpointLocks, setDirection]);

  const handleFillModeChange = useCallback((enabled: boolean) => {
    if (!enabled) clearEndpointLocks();
    setFillMode(enabled);
  }, [clearEndpointLocks]);

  const handlePresetSelect = useCallback(
    (preset: GradientPreset) => {
      if (fillMode) return;
      clearEndpointLocks();
      applyPreset(preset);
    },
    [applyPreset, clearEndpointLocks, fillMode]
  );

  const handleClearPreview = useCallback(() => {
    clearEndpointLocks(false);
    clearSlots();
  }, [clearEndpointLocks, clearSlots]);

  /** 复制当前预览布局到剪贴板。 */
  const handleCopyLayout = useCallback(async () => {
    if (slots.every(hash => !hash)) {
      message.warning('预览为空，无可复制布局');
      return;
    }
    try {
      await navigator.clipboard.writeText(serializeLayout(slots));
      message.success('已复制当前布局');
    } catch (e) {
      console.error('Copy layout failed:', e);
      message.error('复制失败');
    }
  }, [slots]);

  /** 从剪贴板读取并恢复预览布局；恢复属于手动编排，清除端点锁定。 */
  const handleImportLayout = useCallback(async () => {
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch (e) {
      console.error('Read clipboard failed:', e);
      message.error('读取剪贴板失败');
      return;
    }

    const parsed = parseLayout(text, candidateHashSet);
    if (!parsed) {
      message.error('剪贴板内容不是有效布局');
      return;
    }
    if (parsed.placed === 0) {
      message.warning('布局中没有可用名片');
      return;
    }

    clearEndpointLocks(false);
    fillSlots(parsed.slots);
    if (parsed.dropped > 0) {
      message.warning(`已恢复 ${parsed.placed} 张名片，${parsed.dropped} 张不可用已跳过`);
    } else {
      message.success(`已恢复 ${parsed.placed} 张名片`);
    }
  }, [candidateHashSet, clearEndpointLocks, fillSlots]);

  const handleSwap = useCallback((from: number, to: number) => {
    if (fillMode) {
      if (endpointLocksRef.current[from]) return;
      if (isEndpointSlot(to, direction)) {
        const hash = slots[from];
        if (hash) setEndpointCard(to, hash);
        return;
      }
    }

    swapSlots(from, to);
  }, [direction, fillMode, setEndpointCard, slots, swapSlots]);

  const handleRemove = useCallback((index: number) => {
    if (fillMode && endpointLocksRef.current[index]) return;
    removeSlot(index);
  }, [fillMode, removeSlot]);

  const handleOpenModal = useCallback((hash: string) => setModalHash(hash), []);
  const handleCloseModal = useCallback(() => setModalHash(null), []);

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <h1 className="app__title">提瓦特色谱</h1>
          <span className="app__subtitle">以色彩编排名片，生成专属渐变收藏墙</span>
        </div>
      </header>

      <main className="app__main">
        <aside className="app__left">
          {loading ? (
            <p className="loading">名片加载中...</p>
          ) : (
            <NamecardWall
              filteredNamecards={displayedNamecards}
              totalNamecards={namecards.length}
              filter={filter}
              disabledSet={disabledSet}
              onFilterChange={updateFilter}
              onToggleDisable={toggleDisabled}
              onOpenModal={handleOpenModal}
            />
          )}
        </aside>

        <section className="app__right">
          <Preview
            slots={slots}
            colorMap={colorMap}
            color1={color1}
            color2={color2}
            direction={direction}
            fillMode={fillMode}
            presets={presets}
            onColor1Change={handleColor1Change}
            onColor2Change={handleColor2Change}
            onDirectionChange={handleDirectionChange}
            onFillModeChange={handleFillModeChange}
            onPresetSelect={handlePresetSelect}
            onDrop={handleDrop}
            onSwap={handleSwap}
            onRemove={handleRemove}
            onClear={handleClearPreview}
            onCopyLayout={handleCopyLayout}
            onImportLayout={handleImportLayout}
          />
        </section>
      </main>

      <NamecardDetail
        card={selectedCard}
        onClose={handleCloseModal}
      />
    </div>
  );
}
