/**
 * #117 NG ワード / 添付拡張子ブロックリストの管理と判定
 *
 * MVP方針:
 *   - NG ワード判定は文字列の部分一致のみ（is_regex は将来拡張用に保持。MVPでは未使用）
 *   - pattern と投稿コンテンツを NFKC + lowercase で正規化してから照合
 *   - 1 投稿に block と warn 両方マッチした場合は block 優先
 *   - 30 秒 TTL のプロセス内キャッシュ。CRUD で invalidate
 */
import { query, queryOne, execute } from '../db/database';
import {
  NgWord,
  NgWordAction,
  NgWordCheckResult,
  CreateNgWordInput,
  UpdateNgWordInput,
  BlockedExtension,
  CreateBlockedExtensionInput,
} from '@chat-app/shared';
import { createError } from '../middleware/errorHandler';

interface NgWordRow {
  id: number;
  pattern: string;
  is_regex: boolean;
  action: NgWordAction;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

interface BlockedExtensionRow {
  id: number;
  extension: string;
  reason: string | null;
  created_by: number | null;
  created_at: string;
}

function toNgWord(row: NgWordRow): NgWord {
  return {
    id: row.id,
    pattern: row.pattern,
    isRegex: row.is_regex,
    action: row.action,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toBlockedExtension(row: BlockedExtensionRow): BlockedExtension {
  return {
    id: row.id,
    extension: row.extension,
    reason: row.reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/** NFKC + lowercase 正規化 */
function normalize(text: string): string {
  return text.normalize('NFKC').toLowerCase();
}

/** 拡張子をドット無し小文字で抽出。拡張子が無いときは null */
export function extractExtension(filename: string): string | null {
  const idx = filename.lastIndexOf('.');
  if (idx === -1 || idx === filename.length - 1) return null;
  return filename.slice(idx + 1).toLowerCase();
}

// ─── キャッシュ ────────────────────────────────────────────────
const CACHE_TTL_MS = 30_000;

interface NgWordCache {
  fetchedAt: number;
  // 正規化済み pattern / action の対のみ保持（is_active=true のものだけ）
  entries: { normalizedPattern: string; action: NgWordAction; rawPattern: string }[];
}

let ngWordCache: NgWordCache | null = null;

interface BlocklistCache {
  fetchedAt: number;
  extensions: Set<string>;
}

let blocklistCache: BlocklistCache | null = null;

export function invalidateCaches(): void {
  ngWordCache = null;
  blocklistCache = null;
}

async function getActiveNgWords(): Promise<NgWordCache['entries']> {
  const now = Date.now();
  if (ngWordCache && now - ngWordCache.fetchedAt < CACHE_TTL_MS) {
    return ngWordCache.entries;
  }
  const rows = await query<{ pattern: string; action: NgWordAction }>(
    'SELECT pattern, action FROM ng_words WHERE is_active = true',
  );
  const entries = rows.map((r) => ({
    normalizedPattern: normalize(r.pattern),
    action: r.action,
    rawPattern: r.pattern,
  }));
  ngWordCache = { fetchedAt: now, entries };
  return entries;
}

async function getBlockedExtensionSet(): Promise<Set<string>> {
  const now = Date.now();
  if (blocklistCache && now - blocklistCache.fetchedAt < CACHE_TTL_MS) {
    return blocklistCache.extensions;
  }
  const rows = await query<{ extension: string }>('SELECT extension FROM attachment_blocklist');
  const extensions = new Set(rows.map((r) => r.extension.toLowerCase()));
  blocklistCache = { fetchedAt: now, extensions };
  return extensions;
}

// ─── 判定 API ───────────────────────────────────────────────────

/**
 * NG ワード判定。block 優先で先頭から評価。マッチなしなら null。
 */
export async function checkContent(content: string): Promise<NgWordCheckResult | null> {
  const entries = await getActiveNgWords();
  if (entries.length === 0) return null;

  const normalizedContent = normalize(content);
  let warnHit: NgWordCheckResult | null = null;

  for (const entry of entries) {
    if (!entry.normalizedPattern) continue;
    if (normalizedContent.includes(entry.normalizedPattern)) {
      if (entry.action === 'block') {
        return { action: 'block', matchedPattern: entry.rawPattern };
      }
      if (entry.action === 'warn' && warnHit === null) {
        warnHit = { action: 'warn', matchedPattern: entry.rawPattern };
      }
    }
  }

  return warnHit;
}

/**
 * 拡張子がブロック対象なら true。
 */
export async function checkExtension(filename: string): Promise<boolean> {
  const ext = extractExtension(filename);
  if (ext === null) return false;
  const blocked = await getBlockedExtensionSet();
  return blocked.has(ext);
}

// ─── NG ワード CRUD ────────────────────────────────────────────

export async function listNgWords(): Promise<NgWord[]> {
  const rows = await query<NgWordRow>('SELECT * FROM ng_words ORDER BY id ASC');
  return rows.map(toNgWord);
}

export async function createNgWord(input: CreateNgWordInput, userId: number): Promise<NgWord> {
  const pattern = input.pattern?.trim();
  if (!pattern) throw createError('pattern is required', 400);

  const action: NgWordAction = input.action ?? 'block';
  if (action !== 'block' && action !== 'warn') {
    throw createError('Invalid action', 400);
  }

  const row = await queryOne<NgWordRow>(
    `INSERT INTO ng_words (pattern, is_regex, action, is_active, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [pattern, input.isRegex ?? false, action, input.isActive ?? true, userId],
  );
  invalidateCaches();
  return toNgWord(row!);
}

export async function updateNgWord(id: number, input: UpdateNgWordInput): Promise<NgWord> {
  const existing = await queryOne<NgWordRow>('SELECT * FROM ng_words WHERE id = $1', [id]);
  if (!existing) throw createError('NG word not found', 404);

  const nextPattern = input.pattern !== undefined ? input.pattern.trim() : existing.pattern;
  if (!nextPattern) throw createError('pattern must not be empty', 400);

  const nextAction = input.action ?? existing.action;
  if (nextAction !== 'block' && nextAction !== 'warn') {
    throw createError('Invalid action', 400);
  }

  const nextIsActive = input.isActive ?? existing.is_active;
  const nextIsRegex = input.isRegex ?? existing.is_regex;

  const row = await queryOne<NgWordRow>(
    `UPDATE ng_words
       SET pattern = $1, action = $2, is_active = $3, is_regex = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
    [nextPattern, nextAction, nextIsActive, nextIsRegex, id],
  );
  invalidateCaches();
  return toNgWord(row!);
}

export async function deleteNgWord(id: number): Promise<void> {
  const existing = await queryOne('SELECT id FROM ng_words WHERE id = $1', [id]);
  if (!existing) throw createError('NG word not found', 404);
  await execute('DELETE FROM ng_words WHERE id = $1', [id]);
  invalidateCaches();
}

// ─── 拡張子ブロックリスト CRUD ─────────────────────────────────

export async function listBlockedExtensions(): Promise<BlockedExtension[]> {
  const rows = await query<BlockedExtensionRow>(
    'SELECT * FROM attachment_blocklist ORDER BY id ASC',
  );
  return rows.map(toBlockedExtension);
}

export async function createBlockedExtension(
  input: CreateBlockedExtensionInput,
  userId: number,
): Promise<BlockedExtension> {
  const raw = input.extension?.trim();
  if (!raw) throw createError('extension is required', 400);

  // ドット先頭・大文字を許容して正規化（"EXE" や ".exe" → "exe"）
  const normalizedExt = raw.replace(/^\./, '').toLowerCase();
  if (!normalizedExt) throw createError('extension is required', 400);

  const dup = await queryOne('SELECT id FROM attachment_blocklist WHERE extension = $1', [
    normalizedExt,
  ]);
  if (dup) throw createError('extension already registered', 409);

  const row = await queryOne<BlockedExtensionRow>(
    `INSERT INTO attachment_blocklist (extension, reason, created_by)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [normalizedExt, input.reason ?? null, userId],
  );
  invalidateCaches();
  return toBlockedExtension(row!);
}

export async function deleteBlockedExtension(id: number): Promise<void> {
  const existing = await queryOne('SELECT id FROM attachment_blocklist WHERE id = $1', [id]);
  if (!existing) throw createError('blocked extension not found', 404);
  await execute('DELETE FROM attachment_blocklist WHERE id = $1', [id]);
  invalidateCaches();
}
