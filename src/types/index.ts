export type TaskStatus = 'not_started' | 'in_progress' | 'in_review' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type UserRole = 'admin' | 'member';
export type AccountStatus = 'pending' | 'invited' | 'active';
export type FieldType = 'text' | 'picklist';
export type FieldEntity = 'task' | 'user';

export interface AssignedUser {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
}

export interface CustomFieldDef {
  id: string;
  label: string;
  fieldKey: string;
  type: FieldType;
  entity: FieldEntity;
  showInListView: boolean;
  options: string[];
  required: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCustomField {
  fieldId: string;
  fieldKey: string;
  label: string;
  type: FieldType;
  value: string;
}

export interface UserCustomField {
  fieldId: string;
  fieldKey: string;
  label: string;
  type: FieldType;
  value: string;
}

export interface Subtask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignees: AssignedUser[];
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  assignees: AssignedUser[];
  customFields: TaskCustomField[];
  // Subtask fields
  parentId?: string | null;
  subtasks?: Subtask[];
  subtaskCount?: number;
  completedSubtaskCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommentAuthor {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
}

export interface Comment {
  id: string;
  content: string;
  author: CommentAuthor;
  parentId?: string | null;
  replies?: Comment[];
  createdAt: string;
  updatedAt: string;
}

export interface BoardReaction {
  emoji: string;
  count: number;
  reacted: boolean; // whether current user has reacted
}

export interface BoardComment {
  id: string;
  content: string;
  author: CommentAuthor;
  parentId?: string | null;
  replies?: BoardComment[];
  reactions: BoardReaction[];
  pinned: boolean;
  pinnedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCommentFeedReply {
  id: string;
  content: string;
  author: { id: string; fullName: string; avatarUrl?: string | null };
  createdAt: string;
  updatedAt: string;
}

export interface TaskCommentFeed {
  id: string;
  content: string;
  author: { id: string; fullName: string; avatarUrl?: string | null };
  task: { id: string; title: string };
  pinned: boolean;
  pinnedAt?: string | null;
  replyCount: number;
  replies: TaskCommentFeedReply[];
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  avatarUrl?: string | null;
  customFields: UserCustomField[];
  createdAt: string;
}


export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  completed: 'Done',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  not_started: 'bg-slate-100 text-slate-600 border-slate-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  in_review: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-slate-100 text-slate-500 border-slate-200',
  medium: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  high: 'bg-orange-50 text-orange-600 border-orange-200',
  critical: 'bg-red-50 text-red-600 border-red-200',
};

export const PRIORITY_DOT: Record<TaskPriority, string> = {
  low: 'bg-gray-400',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};
