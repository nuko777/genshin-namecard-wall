import { useState, useEffect, useRef } from 'react';
import { Cascader, Checkbox, Input, Space } from 'antd';
import type { FilterState } from '../../types';

const ELEMENT_OPTIONS = [
  { label: '风', value: '风' },
  { label: '岩', value: '岩' },
  { label: '雷', value: '雷' },
  { label: '草', value: '草' },
  { label: '水', value: '水' },
  { label: '火', value: '火' },
  { label: '冰', value: '冰' },
];

const REGION_OPTIONS = [
  { label: '蒙德', value: '蒙德' },
  { label: '璃月', value: '璃月' },
  { label: '稻妻', value: '稻妻' },
  { label: '须弥', value: '须弥' },
  { label: '枫丹', value: '枫丹' },
  { label: '纳塔', value: '纳塔' },
  { label: '挪德卡莱', value: '挪德卡莱' },
  { label: '至冬', value: '至冬' },
];

const THEME_OPTIONS = [
  { label: '地区', value: 'region', children: REGION_OPTIONS },
  { label: '元素', value: 'character', children: ELEMENT_OPTIONS },
  { label: '成就', value: 'achievement' },
  { label: '纪行', value: 'battlepass' },
  { label: '活动', value: 'event' },
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
  const categoryValue = filter.theme
    ? [filter.theme, filter.theme === 'character' ? filter.element : filter.region].filter(Boolean)
    : undefined;

  // Sync external filter.search changes (e.g. reset) to local input
  useEffect(() => {
    setLocalSearch(filter.search);
  }, [filter.search]);

  // 卸载时清理未触发的搜索去抖定时器，避免对已卸载组件回调
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange({ search: value });
    }, 200);
  };

  const handleCategoryChange = (value: (string | number)[] | null) => {
    if (!value?.length) {
      onChange({ theme: '', element: '', region: '' });
      return;
    }

    const [theme = '', secondary = ''] = value.map(String);
    onChange({
      theme,
      element: theme === 'character' ? secondary : '',
      region: theme === 'region' ? secondary : '',
    });
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
        <Cascader
          size="small"
          style={{ width: 140 }}
          value={categoryValue}
          placeholder="分类"
          allowClear
          changeOnSelect
          options={THEME_OPTIONS}
          onChange={handleCategoryChange}
        />
        <Checkbox
          checked={filter.hideDisabled}
          onChange={e => onChange({ hideDisabled: e.target.checked })}
        >
          隐藏已禁用
        </Checkbox>
        <Checkbox
          checked={filter.enableBattlepass}
          onChange={e => onChange({ enableBattlepass: e.target.checked })}
        >
          启用纪行名片
        </Checkbox>
      </Space>
      <span className="filter-bar__count">显示 {count} / {total} 张</span>
    </div>
  );
}
