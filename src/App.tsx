import { useState, useCallback, useMemo } from 'react';
import './App.less';
import type { Namecard, GradientPreset } from './types';
import type { Candidate } from './utils/gradient';
import NamecardWall from './components/NamecardWall';
import Preview from './components/Preview';
import NamecardDetail from './components/Modal/NamecardDetail';
import { useNamecards } from './hooks/useNamecards';
import { useDisabled } from './hooks/useDisabled';
import { usePreview } from './hooks/usePreview';
import { useGradient } from './hooks/useGradient';

export default function App() {
  const { namecards, filteredNamecards, loading, filter, updateFilter } = useNamecards();
  const { disabledSet, isDisabled, toggle: toggleDisabled } = useDisabled();
  const { slots, dropIntoSlot, swapSlots, fillSlots, clearSlots, removeSlot } = usePreview();
  const {
    color1,
    color2,
    direction,
    presets,
    setColor1,
    setColor2,
    setDirection,
    generate,
    applyPreset,
  } = useGradient();

  const [modalHash, setModalHash] = useState<string | null>(null);

  // Apply hideDisabled filter to the display list
  const displayedNamecards = useMemo(() =>
    filter.hideDisabled
      ? filteredNamecards.filter(c => !disabledSet.has(c.hash))
      : filteredNamecards,
    [filteredNamecards, filter.hideDisabled, disabledSet]
  );

  // Pre-compute candidate pool (shared by generate + preset handlers)
  const candidates = useMemo<Candidate[]>(() =>
    namecards
      .filter(c =>
        !disabledSet.has(c.hash) &&
        c.avgColor.length >= 3 &&
        c.zones?.length === 6 &&
        typeof c.variance === 'number'
      )
      .map(c => ({ hash: c.hash, avgColor: c.avgColor, zones: c.zones, variance: c.variance })),
    [namecards, disabledSet]
  );

  // Build namecard lookup map for O(1) modal access
  const namecardMap = useMemo(() => {
    const m = new Map<string, Namecard>();
    namecards.forEach(c => m.set(c.hash, c));
    return m;
  }, [namecards]);

  const selectedCard = modalHash ? namecardMap.get(modalHash) ?? null : null;

  const handleDrop = useCallback(
    (index: number, hash: string) => {
      if (!namecardMap.has(hash)) return;
      dropIntoSlot(index, hash);
    },
    [dropIntoSlot, namecardMap]
  );

  const handleGenerate = useCallback(() => {
    fillSlots(generate(candidates));
  }, [candidates, generate, fillSlots]);

  // Pass preset colors directly to bypass React batching delay
  const handlePresetSelect = useCallback(
    (preset: GradientPreset) => {
      applyPreset(preset);
      const hashes = generate(candidates, preset.color1, preset.color2);
      fillSlots(hashes);
    },
    [applyPreset, candidates, generate, fillSlots]
  );

  const handleOpenModal = useCallback((hash: string) => setModalHash(hash), []);
  const handleCloseModal = useCallback(() => setModalHash(null), []);

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">原神名片墙</h1>
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
            namecardMap={namecardMap}
            color1={color1}
            color2={color2}
            direction={direction}
            presets={presets}
            onColor1Change={setColor1}
            onColor2Change={setColor2}
            onDirectionChange={setDirection}
            onPresetSelect={handlePresetSelect}
            onGenerate={handleGenerate}
            onDrop={handleDrop}
            onSwap={swapSlots}
            onRemove={removeSlot}
            onClear={clearSlots}
          />
        </section>
      </main>

      <NamecardDetail
        card={selectedCard}
        disabled={modalHash ? isDisabled(modalHash) : false}
        onClose={handleCloseModal}
        onToggleDisable={() => modalHash && toggleDisabled(modalHash)}
      />
    </div>
  );
}
