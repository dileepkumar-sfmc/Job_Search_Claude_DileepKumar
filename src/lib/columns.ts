import type { ColumnId } from '../types';

export interface ColumnMeta {
  id: ColumnId;
  label: string;
  /** CSS var for the status accent dot / border */
  color: string;
}

export const COLUMNS: ColumnMeta[] = [
  { id: 'wishlist', label: 'Wishlist', color: 'var(--status-wishlist)' },
  { id: 'applied', label: 'Applied', color: 'var(--status-applied)' },
  { id: 'interview', label: 'Interview', color: 'var(--status-interview)' },
  { id: 'offer', label: 'Offer', color: 'var(--status-offer)' },
  { id: 'rejected', label: 'Rejected', color: 'var(--status-rejected)' },
];

export const COLUMN_IDS: ColumnId[] = COLUMNS.map((c) => c.id);

export const COLUMN_BY_ID: Record<ColumnId, ColumnMeta> = Object.fromEntries(
  COLUMNS.map((c) => [c.id, c])
) as Record<ColumnId, ColumnMeta>;
