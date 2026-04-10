export interface Channel {
  id: number;
  name: string;
  description: string | null;
  createdBy: number;
  createdAt: string;
}

export interface CreateChannelInput {
  name: string;
  description?: string;
}
