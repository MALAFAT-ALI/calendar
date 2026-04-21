import { Timestamp } from 'firebase/firestore';

export interface Category {
  id: string;
  uid: string;
  name: string;
  color: string;
  icon: string;
  isChained: boolean; // Renamed from isSequential
}

export interface ChangeLog {
  id: string;
  timestamp: Timestamp;
  type: 'move' | 'resize' | 'edit';
  oldStart: Timestamp;
  oldEnd: Timestamp;
  newStart: Timestamp;
  newEnd: Timestamp;
  reason?: string;
  notes?: string;
}

export interface Task {
  id: string;
  uid: string;
  title: string;
  categoryId: string;
  startDate: Timestamp;
  endDate: Timestamp;
  order: number;
  isChained: boolean;
  isApproved: boolean;
  isCompleted?: boolean;
  notes?: string;
  previousStartDate?: Timestamp;
  previousEndDate?: Timestamp;
  delayReason?: string;
  changeLogs?: ChangeLog[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
