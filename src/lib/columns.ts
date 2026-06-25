import type { ColumnId } from '../types';

export interface ColumnMeta {
  id: ColumnId;
  label: string;
  /** CSS var for the status accent dot / border */
  color: string;
  /** Shown in the empty-column placeholder for this stage */
  emptyHint: string;
}

export const COLUMNS: ColumnMeta[] = [
  { id: 'wishlist', label: 'Wishlist', color: 'var(--status-wishlist)', emptyHint: 'Roles you want to pursue' },
  { id: 'applied', label: 'Applied', color: 'var(--status-applied)', emptyHint: "Jobs you've applied to" },
  { id: 'interview', label: 'Interview', color: 'var(--status-interview)', emptyHint: 'Calls and on-sites' },
  { id: 'offer', label: 'Offer', color: 'var(--status-offer)', emptyHint: 'Offers on the table' },
  { id: 'rejected', label: 'Rejected', color: 'var(--status-rejected)', emptyHint: 'Closed or passed' },
];

export const COLUMN_IDS: ColumnId[] = COLUMNS.map((c) => c.id);

export const COLUMN_BY_ID: Record<ColumnId, ColumnMeta> = Object.fromEntries(
  COLUMNS.map((c) => [c.id, c])
) as Record<ColumnId, ColumnMeta>;
