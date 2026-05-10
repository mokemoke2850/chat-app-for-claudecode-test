/**
 * テスト対象: useLocalTime hook（#306）
 *
 * 役割:
 *   - 指定した IANA タイムゾーンに基づいて、現在のローカル時刻文字列と
 *     深夜帯判定フラグを返す
 *   - timezone 未設定時は null を返し、呼び出し側で表示を抑制できる
 *   - 1分（または適切な間隔）ごとに値が更新される
 */

import { describe, it } from 'vitest';

describe('useLocalTime', () => {
  describe('正常系', () => {
    it.todo('timezone "Asia/Tokyo" を渡すと JST の時刻文字列を返す');
    it.todo('timezone "America/New_York" を渡すと EST/EDT の時刻文字列を返す');
    it.todo('timezone "UTC" を渡すと UTC の時刻文字列を返す');
    it.todo('返却値は { time: string; isLateNight: boolean } 構造（または同等）になっている');
  });

  describe('未設定 / 異常系', () => {
    it.todo('timezone が null のときは null を返す');
    it.todo('timezone が undefined のときは null を返す');
    it.todo('timezone が空文字のときは null を返す');
    it.todo('不正な IANA 値（例: "Foo/Bar"）を渡してもスローせず null を返す');
  });

  describe('深夜帯判定', () => {
    it.todo('現在時刻が 22:00 のとき isLateNight が true になる');
    it.todo('現在時刻が 0:00 のとき isLateNight が true になる');
    it.todo('現在時刻が 6:59 のとき isLateNight が true になる');
    it.todo('現在時刻が 7:00 のとき isLateNight が false になる');
    it.todo('現在時刻が 12:00 のとき isLateNight が false になる');
    it.todo('現在時刻が 21:59 のとき isLateNight が false になる');
  });

  describe('時間経過による更新', () => {
    it.todo('1分経過すると返却される time が更新される');
    it.todo('22:00 を跨ぐと isLateNight が false → true に切り替わる');
    it.todo('7:00 を跨ぐと isLateNight が true → false に切り替わる');
    it.todo('アンマウント時にタイマーがクリアされる（メモリリークしない）');
  });

  describe('引数変更', () => {
    it.todo('timezone を変更すると即座に新しいタイムゾーンの時刻に切り替わる');
    it.todo('timezone を null から有効値に変えると null から時刻文字列に切り替わる');
    it.todo('timezone を有効値から null に変えると null に切り替わる');
  });
});
