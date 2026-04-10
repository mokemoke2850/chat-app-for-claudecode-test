import { Quill } from 'react-quill-new';

export interface MentionData {
  id: number;
  value: string; // username
}

// EmbedBlot — inline embed (like an image but for mentions)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EmbedBlot = Quill.import('blots/embed') as any;

class MentionBlot extends EmbedBlot {
  static blotName = 'mention';
  static tagName = 'span';
  static className = 'ql-mention';

  static create(data: MentionData): HTMLElement {
    const node = super.create() as HTMLElement;
    node.dataset.id = String(data.id);
    node.dataset.value = data.value;
    node.textContent = `@${data.value}`;
    node.setAttribute('contenteditable', 'false');
    return node;
  }

  static value(node: HTMLElement): MentionData {
    return {
      id: Number(node.dataset.id),
      value: node.dataset.value ?? '',
    };
  }
}

// Register once at module level — runs before any editor mounts
Quill.register({ 'formats/mention': MentionBlot });
