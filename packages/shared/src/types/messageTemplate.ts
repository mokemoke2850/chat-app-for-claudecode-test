export interface MessageTemplate {
  id: number;
  userId: number;
  title: string;
  body: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMessageTemplateInput {
  title: string;
  body: string;
}

export interface UpdateMessageTemplateInput {
  title?: string;
  body?: string;
  position?: number;
}
