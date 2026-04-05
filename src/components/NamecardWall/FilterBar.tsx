import { useState, useEffect, useRef } from 'react';
import { Select, Checkbox, Input, Space } from 'antd';
import type { FilterState } from '../../types';

const THEME_OPTIONS = [
  { label: '全部主题', value: '' },
  { label: '角色', value: 'character' },
  { label: '成就', value: 'achievement' },
  { label: '地区', value: 'region' },
  { label: '活动', value: 'event' },
  { label: '其他', value: 'other' },
];

const REGION_OPTIONS = [
  { label: '全部地区', value: '' },
  { label: '蒙德', value: '蒙德' },
  { label: '璃月', value: '璃月' },
  { label: '稻妻', value: '稻妻' },
  { label: '须弥', value: '须弥' },
  { label: '枫丹', value: '枫丹' },
  { label: '纳塔', value: '纳塔' },
  { label: '至冬', value: '至冬' },
  { label: '其他', value: '其他' },
];

const ELEMENT_OPTIONS = [
  { label: '全部元素', value: '' },
  { label: '风', value: '风' },
  { label: '岩', value: '岩' },
  { label: '雷', value: '雷' },
  { label: '草', value: '草' },
  { label: '水', value: '水' },
  { label: '火', value: '火' },
  { label: '冰', value: '冰' },
];

interface FilterBarProps {
  filter: FilterState;
  count: number;
  total: number;
  onChange: (partial: Partial<FilterState>) => void;
}

export default function FilterBar({ filter, count, total, onChange }: FilterBarProps) {
  const [localSearch, setLocalSearch] = useState(filter.search);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync external filter.search changes (e.g. reset) to local input
  useEffect(() => {
    setLocalSearch(filter.search);
  }, [filter.search]);

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange({ search: value });
    }, 200);
  };

  return (
    <div className="filter-bar">
      <Input.Search
        size="small"
        placeholder="搜索名片名称..."
        allowClear
        value={localSearch}
        onChange={e => handleSearchChange(e.target.value)}
        onSearch={value => {
          clearTimeout(timerRef.current);
          onChange({ search: value });
        }}
        style={{ width: 200 }}
      />
      <Space size="small" wrap>
        <Select
          size="small"
          style={{ width: 100 }}
          value={filter.theme || undefined}
          options={THEME_OPTIONS}
          onChange={v => onChange({ theme: v ?? '' })}
        />
        <Select
          size="small"
          style={{ width: 100 }}
          value={filter.region || undefined}
          options={REGION_OPTIONS}
          onChange={v => onChange({ region: v ?? '' })}
        />
        <Select
          size="small"
          style={{ width: 100 }}
          value={filter.element || undefined}
          options={ELEMENT_OPTIONS}
          onChange={v => onChange({ element: v ?? '' })}
        />
        <Checkbox
          checked={filter.hideDisabled}
          onChange={e => onChange({ hideDisabled: e.target.checked })}
        >
          隐藏已禁用
        </Checkbox>
      </Space>
      <span className="filter-bar__count">显示 {count} / {total} 张</span>
    </div>
  );
}
