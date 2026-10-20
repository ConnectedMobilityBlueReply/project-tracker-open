import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowsDownUp, CaretLeft, CaretRight, ListDashes, Rows } from '@phosphor-icons/react';
import { useTableState, type TableDirection } from '@/lib/useTableState';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorBanner, LoadingState } from '@/components/app/StateMessages';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export type TableDensity = 'compact' | 'comfortable';

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  accessor?: (row: T) => unknown;
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  data: readonly T[];
  columns: readonly DataTableColumn<T>[];
  getRowId?: (row: T, index: number) => string | number;
  pageSize?: number;
  defaultSort?: string | null;
  defaultDirection?: TableDirection;
  searchPlaceholder?: string;
  /** Omette il campo di ricerca interno (la pagina filtra i dati a monte). */
  hideSearch?: boolean;
  densityStorageKey?: string;
  loading?: boolean;
  loadingState?: ReactNode;
  emptyState?: ReactNode;
  error?: ReactNode;
  onRetry?: () => void;
  onRowActivate?: (row: T) => void;
  rowLabel?: (row: T) => string;
  /** Senza bordo né raggio propri: per tabelle dentro una SectionCard con bodyClassName="p-0". */
  bare?: boolean;
}

const DEFAULT_DENSITY_KEY = 'project-tracker:data-table-density';

function readDensity(key: string): TableDensity {
  if (typeof window === 'undefined') return 'compact';
  try {
    return window.localStorage.getItem(key) === 'comfortable' ? 'comfortable' : 'compact';
  } catch {
    return 'compact';
  }
}

function comparableValue(value: unknown): string | number {
  if (typeof value === 'number') return value;
  if (value == null) return '';
  return String(value).toLocaleLowerCase();
}

function compareValues(left: unknown, right: unknown): number {
  const a = comparableValue(left);
  const b = comparableValue(right);
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function DataTable<T>({
  data,
  columns,
  getRowId = (_, index) => index,
  pageSize = 25,
  defaultSort = null,
  defaultDirection = 'asc',
  searchPlaceholder = 'Cerca nella tabella…',
  hideSearch = false,
  densityStorageKey = DEFAULT_DENSITY_KEY,
  loading = false,
  loadingState = <LoadingState />,
  emptyState = <p className="py-10 text-center text-sm text-muted-foreground">Nessun risultato.</p>,
  error,
  onRetry,
  onRowActivate,
  rowLabel,
  bare = false,
}: DataTableProps<T>) {
  const tableState = useTableState({ defaultSort, defaultDirection });
  const [density, setDensity] = useState<TableDensity>(() => readDensity(densityStorageKey));
  const rowPadding = density === 'compact' ? 'py-1.5' : 'py-3';
  const headPadding = density === 'compact' ? 'py-2' : 'py-3';

  useEffect(() => {
    try {
      window.localStorage.setItem(densityStorageKey, density);
    } catch {
      // A blocked storage is non-fatal: the current density still works.
    }
  }, [density, densityStorageKey]);

  const filteredRows = useMemo(() => {
    const query = tableState.query.trim().toLocaleLowerCase();
    if (!query) return [...data];
    return data.filter(row => columns.some(column => {
      const value = column.accessor ? column.accessor(row) : '';
      return String(value ?? '').toLocaleLowerCase().includes(query);
    }));
  }, [columns, data, tableState.query]);

  const sortedRows = useMemo(() => {
    if (!tableState.sort) return filteredRows;
    const column = columns.find(item => item.key === tableState.sort);
    if (!column?.accessor) return filteredRows;
    const direction = tableState.direction === 'asc' ? 1 : -1;
    return [...filteredRows].sort((left, right) => direction * compareValues(column.accessor!(left), column.accessor!(right)));
  }, [columns, filteredRows, tableState.direction, tableState.sort]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / Math.max(1, pageSize)));
  const safePageSize = Math.max(1, pageSize);
  const currentPage = Math.min(tableState.page, pageCount);
  const visibleRows = sortedRows.slice((currentPage - 1) * safePageSize, currentPage * safePageSize);
  const firstRow = sortedRows.length === 0 ? 0 : (currentPage - 1) * safePageSize + 1;
  const lastRow = Math.min(currentPage * safePageSize, sortedRows.length);

  const activateRow = (row: T) => onRowActivate?.(row);
  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    activateRow(row);
  };

  const renderState = () => {
    if (loading) return loadingState;
    if (error) {
      return <ErrorBanner onRetry={onRetry}>{error}</ErrorBanner>;
    }
    if (visibleRows.length === 0) return emptyState;
    return null;
  };

  return (
    <div className={cn('space-y-3', bare && 'space-y-0')}>
      <div className={cn(cn('flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between', hideSearch && 'sm:justify-end'), bare && 'px-4 py-3')}>
        {!hideSearch && (
          <label className="min-w-0 flex-1">
            <span className="sr-only">Cerca</span>
            <Input
              value={tableState.query}
              onChange={event => tableState.setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
            />
          </label>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={density === 'comfortable'}
          aria-label={`Densità ${density === 'compact' ? 'compatta' : 'comoda'}`}
          onClick={() => setDensity(value => value === 'compact' ? 'comfortable' : 'compact')}
        >
          {density === 'compact' ? <ListDashes aria-hidden="true" /> : <Rows aria-hidden="true" />}
          {density === 'compact' ? 'Compatta' : 'Comoda'}
        </Button>
      </div>

      <div className={bare ? 'overflow-x-auto border-y border-border' : 'overflow-x-auto rounded-lg border border-border'}>
        {renderState() ? (
          <div>{renderState()}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column, index) => {
                  const active = tableState.sort === column.key;
                  const nextDirection = active && tableState.direction === 'asc' ? 'desc' : 'asc';
                  return (
                    <TableHead
                      key={column.key}
                      className={cn(headPadding, index === 0 && 'sticky left-0 z-10 bg-background', column.headerClassName)}
                    >
                      {column.sortable ? (
                        <button
                          type="button"
                          className="inline-flex min-h-8 items-center gap-1 rounded-md text-left font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => tableState.setSort(column.key, nextDirection)}
                        >
                          {column.header}
                          {active
                            ? tableState.direction === 'asc' ? <ArrowUp aria-hidden="true" className="size-3.5" /> : <ArrowDown aria-hidden="true" className="size-3.5" />
                            : <ArrowsDownUp aria-hidden="true" className="size-3.5 text-muted-foreground" />}
                        </button>
                      ) : column.header}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row, rowIndex) => (
                <TableRow
                  key={getRowId(row, rowIndex)}
                  onClick={onRowActivate ? () => activateRow(row) : undefined}
                  onKeyDown={onRowActivate ? event => handleRowKeyDown(event, row) : undefined}
                  tabIndex={onRowActivate ? 0 : undefined}
                  role={onRowActivate ? 'button' : undefined}
                  aria-label={onRowActivate && rowLabel ? rowLabel(row) : undefined}
                  className={cn(onRowActivate && 'cursor-pointer focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring')}
                >
                  {columns.map((column, columnIndex) => (
                    <TableCell
                      key={column.key}
                      className={cn(rowPadding, columnIndex === 0 && 'sticky left-0 z-[1] bg-background', column.className)}
                    >
                      {column.cell ? column.cell(row) : String(column.accessor?.(row) ?? '')}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className={cn('flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between', bare && 'px-4 py-3')}>
        <span>{sortedRows.length === 0 ? 'Nessuna riga' : `${firstRow}–${lastRow} di ${sortedRows.length}`}</span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" iconOnly size="sm" aria-label="Pagina precedente" disabled={currentPage <= 1} onClick={() => tableState.setPage(currentPage - 1)}>
            <CaretLeft aria-hidden="true" />
          </Button>
          <span aria-live="polite">Pagina {currentPage} di {pageCount}</span>
          <Button type="button" variant="outline" iconOnly size="sm" aria-label="Pagina successiva" disabled={currentPage >= pageCount} onClick={() => tableState.setPage(currentPage + 1)}>
            <CaretRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
