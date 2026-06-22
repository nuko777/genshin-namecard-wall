import { TOTAL } from './grid';

/** 剪贴板布局文本前缀，带版本号便于后续格式演进。 */
const LAYOUT_PREFIX = 'TVT1:';

/**
 * 将 16 格预览布局序列化为可分享的剪贴板文本。
 * 格式：`TVT1:` 前缀 + 16 个逗号分隔的名片 hash，空格用空串占位。
 */
export function serializeLayout(slots: (string | null)[]): string {
  const tokens = Array.from({ length: TOTAL }, (_, i) => slots[i] ?? '');
  return LAYOUT_PREFIX + tokens.join(',');
}

export interface ParsedLayout {
  /** 解析出的 16 格布局；无效 hash 已被置为 null。 */
  slots: (string | null)[];
  /** 成功落位的名片数量。 */
  placed: number;
  /** 文本中出现但不在有效名片集合内、被丢弃的 hash 数量。 */
  dropped: number;
}

/**
 * 解析剪贴板布局文本，并用 validHashes 校验每个 hash。
 * @param text 剪贴板文本
 * @param validHashes 当前可用名片 hash 集合，用于过滤无效/缺失名片
 * @returns 解析结果；格式非法时返回 null
 */
export function parseLayout(text: string, validHashes: Set<string>): ParsedLayout | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith(LAYOUT_PREFIX)) return null;

  const body = trimmed.slice(LAYOUT_PREFIX.length);
  const tokens = body.split(',');
  if (tokens.length !== TOTAL) return null;

  const slots: (string | null)[] = Array(TOTAL).fill(null);
  let placed = 0;
  let dropped = 0;
  for (let i = 0; i < TOTAL; i++) {
    const hash = tokens[i].trim();
    if (!hash) continue;
    if (validHashes.has(hash)) {
      slots[i] = hash;
      placed++;
    } else {
      dropped++;
    }
  }

  return { slots, placed, dropped };
}
