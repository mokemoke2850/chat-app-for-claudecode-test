/**
 * components/Channel/ChannelTopicBar.tsx のユニットテスト
 *
 * Step 5c-1 で ChannelTopicBar を表示専用 (topic + tags) に簡素化したため、
 * 旧来の編集ダイアログ / 招待リンク / 投稿権限変更系のテストは
 * ChannelSettingsForm.test.tsx に責務移譲した。
 *
 * 本ファイルでは ChannelTopicBar の表示挙動のみを検証する。
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChannelTopicBar from '../components/Channel/ChannelTopicBar';

const baseChannel = {
  id: 1,
  name: 'general',
  description: null,
  createdBy: 1,
  createdAt: '2024-01-01T00:00:00Z',
  isPrivate: false,
  postingPermission: 'everyone' as const,
  unreadCount: 0,
  topic: null,
};

describe('チャンネルヘッダーのトピック表示', () => {
  it('チャンネルにtopicが設定されている場合、ヘッダーにトピックが表示される', () => {
    const channel = { ...baseChannel, topic: 'このチャンネルのトピックです' };
    render(<ChannelTopicBar channel={channel} />);

    expect(screen.getByText('このチャンネルのトピックです')).toBeInTheDocument();
  });

  it('topicがnullの場合、トピックテキストは表示されない', () => {
    render(<ChannelTopicBar channel={baseChannel} />);

    expect(screen.queryByTestId('channel-topic-text')).not.toBeInTheDocument();
  });
});

describe('チャンネルタグ表示 (#115)', () => {
  it('channel.tags が存在するとき TopicBar にタグチップが並んで表示される', () => {
    const channel = {
      ...baseChannel,
      tags: [
        { id: 1, name: 'frontend', useCount: 3, createdAt: '2024-01-01T00:00:00Z' },
        { id: 2, name: 'react', useCount: 1, createdAt: '2024-01-01T00:00:00Z' },
      ],
    };
    render(<ChannelTopicBar channel={channel} onTagClick={vi.fn()} />);

    expect(screen.getByText('#frontend')).toBeInTheDocument();
    expect(screen.getByText('#react')).toBeInTheDocument();
  });

  it('channel.tags が空配列のときタグ表示エリアは描画されない', () => {
    const channel = { ...baseChannel, tags: [] };
    render(<ChannelTopicBar channel={channel} onTagClick={vi.fn()} />);

    expect(screen.queryByTestId('channel-tags')).not.toBeInTheDocument();
  });

  it('タグチップをクリックすると onTagClick が tag.name を引数に呼ばれる', async () => {
    const user = userEvent.setup();
    const onTagClick = vi.fn();
    const channel = {
      ...baseChannel,
      tags: [{ id: 1, name: 'frontend', useCount: 3, createdAt: '2024-01-01T00:00:00Z' }],
    };
    render(<ChannelTopicBar channel={channel} onTagClick={onTagClick} />);

    await user.click(screen.getByText('#frontend'));

    expect(onTagClick).toHaveBeenCalledWith('frontend');
  });
});

// #154 コンパクトヘッダー — トピック省略表示
describe('トピックの省略表示 (#154)', () => {
  it('トピックが長い場合、テキスト要素に overflow/whitespace/textOverflow のスタイルが適用されて1行に収まる', () => {
    const longTopic = 'あ'.repeat(200);
    const channel = { ...baseChannel, topic: longTopic };
    render(<ChannelTopicBar channel={channel} />);

    const topicEl = screen.getByTestId('channel-topic-text');
    // jsdom ではインラインスタイルのみ取れるため、style 属性を直接確認する
    expect(topicEl).toHaveStyle({ overflow: 'hidden' });
    expect(topicEl).toHaveStyle({ whiteSpace: 'nowrap' });
    expect(topicEl).toHaveStyle({ textOverflow: 'ellipsis' });
  });

  it('トピック要素に title 属性でトピック全文が設定されてホバー時に確認できる', () => {
    const topic = 'ホバーで確認できるトピック全文';
    const channel = { ...baseChannel, topic };
    render(<ChannelTopicBar channel={channel} />);

    const topicEl = screen.getByTestId('channel-topic-text');
    expect(topicEl).toHaveAttribute('title', topic);
  });
});
