/**
 * モデレーション関連型
 * - #116 通報 / モデレーションキュー
 * - #117 NG ワード / 添付制限
 */

// ─── #116 通報 / モデレーションキュー ───────────────────────────

export type ReportReason = 'spam' | 'harassment' | 'other';
export type ReportStatus = 'pending' | 'dismissed' | 'actioned';

/** 通報レコード（管理者向け・通報者情報含む） */
export interface MessageReport {
  id: number;
  messageId: number;
  reporterId: number | null;
  reporterUsername: string | null;
  reason: ReportReason;
  comment: string | null;
  status: ReportStatus;
  actionTaken: string | null;
  handledBy: number | null;
  handledAt: string | null;
  createdAt: string;
}

/** 通報作成の入力 */
export interface ReportMessageInput {
  reason: ReportReason;
  comment?: string;
}

// ─── #117 NG ワード / 添付制限 ──────────────────────────────────

export type NgWordAction = 'block' | 'warn';

export interface NgWord {
  id: number;
  pattern: string;
  isRegex: boolean;
  action: NgWordAction;
  isActive: boolean;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNgWordInput {
  pattern: string;
  isRegex?: boolean;
  action?: NgWordAction;
  isActive?: boolean;
}

export interface UpdateNgWordInput {
  pattern?: string;
  isRegex?: boolean;
  action?: NgWordAction;
  isActive?: boolean;
}

export interface BlockedExtension {
  id: number;
  extension: string; // ドット無し小文字
  reason: string | null;
  createdBy: number | null;
  createdAt: string;
}

export interface CreateBlockedExtensionInput {
  extension: string;
  reason?: string | null;
}

/**
 * NG ワード判定結果。
 * - null: 何にもマッチせず、送信OK
 * - block: 送信拒否
 * - warn: 送信は通すがクライアントへ警告を返す
 */
export interface NgWordCheckResult {
  action: NgWordAction;
  matchedPattern: string;
}
