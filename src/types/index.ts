export type TaskStatus = 'not_started' | 'in_progress' | 'in_review' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type UserRole = 'admin' | 'member';
export type AccountStatus = 'pending' | 'invited' | 'active';

export interface AssignedUser {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  assignees: AssignedUser[];
  createdAt: string;
  updatedAt: string;
}

export interface CommentAuthor {
  id: string;
  fullName: string;
  email: string;
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
  not_started: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  in_review: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-gray-100 text-gray-500',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  critical: 'bg-red-100 text-red-600',
};

export const PRIORITY_DOT: Record<TaskPriority, string> = {
  low: 'bg-gray-400',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};
