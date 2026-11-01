/**
 * Column contract shared by CSV and PDF export. Deliberately the same shape as the frontend's
 * `DataTableColumn<T>` minus JSX -- `render(row): ReactNode` becomes `value(row): string|number`,
 * so a module's export columns can be transliterated directly from its page's existing table columns.
 */
export interface ExportColumn<T> {
  key: string;
  header: string;
  value: (row: T) => string | number | null | undefined;
  align?: 'left' | 'right';
}

export interface ExportMeta {
  title: string;
  generatedAt: Date;
  generatedBy?: string;
  filters?: Record<string, string>;
}
