import { useState, useCallback } from 'react';
import type {
  ScheduledMessage,
  CreateScheduledMessageInput,
  UpdateScheduledMessageInput,
} from '@chat-app/shared';
import { api } from '../api/client';

function fetchScheduledMessages(): Promise<ScheduledMessage[]> {
  return api.scheduledMessages.list().then((res) => res.scheduledMessages);
}

export function useScheduledMessages() {
  const [promise, setPromise] = useState<Promise<ScheduledMessage[]>>(() =>
    fetchScheduledMessages(),
  );

  const refresh = useCallback(() => {
    setPromise(fetchScheduledMessages());
  }, []);

  const create = useCallback(
    async (input: CreateScheduledMessageInput): Promise<ScheduledMessage> => {
      const res = await api.scheduledMessages.create(input);
      refresh();
      return res.scheduledMessage;
    },
    [refresh],
  );

  const update = useCallback(
    async (id: number, patch: UpdateScheduledMessageInput): Promise<ScheduledMessage> => {
      const res = await api.scheduledMessages.update(id, patch);
      refresh();
      return res.scheduledMessage;
    },
    [refresh],
  );

  const cancel = useCallback(
    async (id: number): Promise<ScheduledMessage> => {
      const res = await api.scheduledMessages.cancel(id);
      refresh();
      return res.scheduledMessage;
    },
    [refresh],
  );

  return { promise, refresh, create, update, cancel };
}
