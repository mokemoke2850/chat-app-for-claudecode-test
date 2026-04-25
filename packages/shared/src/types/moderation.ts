/**
 * #117 NG ワード / 添付制限 のモデレーション関連型
 */

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
