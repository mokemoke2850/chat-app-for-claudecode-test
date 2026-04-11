export interface Channel {
  id: number;
  name: string;
  description: string | null;
  createdBy: number;
  createdAt: string;
  isPrivate: boolean;
}

export interface CreateChannelInput {
  name: string;
  description?: string;
  isPrivate?: boolean;
}
