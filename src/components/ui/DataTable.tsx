import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
import { useMediaQuery } from '../../hooks/use-media-query';

interface Column {
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  render?: (value: any, row: any, index: number) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  pageSize?: number;
  onRowClick?: (row: any) => void;
  rowClassName?: (row: any) => string;
  footer?: React.ReactNode;
}

const HIDE_CLASS: Record<string, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

export function DataTable({ columns, data, pageSize = 50, onRowClick, rowClassName, footer }: DataTableProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(data.length / pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  return (
    <div className="glass-panel">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full font-sans text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`sticky top-0 whitespace-nowrap px-4 py-3 font-medium text-muted-foreground uppercase tracking-wider text-xs ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.sortable !== false ? 'cursor-pointer select-none hover:text-foreground' : ''} ${col.hideBelow ? HIDE_CLASS[col.hideBelow] : ''}`}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => col.sortable !== false && toggleSort(col.key)}
                >
                  <span className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'justify-end w-full' : ''}`}>
                    {col.label}
                    {sortKey === col.key && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-muted-foreground/60 italic font-medium">
                  No records found
                </td>
              </tr>
            ) : (
              paged.map((row, i) => (
                <React.Fragment key={i}>
                  <tr
                    onClick={() => {
                      if (isMobile && columns.some(c => c.hideBelow)) {
                        setExpandedRow(expandedRow === i ? null : i);
                      } else {
                        onRowClick?.(row);
                      }
                    }}
                    className={`border-b border-border transition-colors hover:bg-muted/50 group ${i % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'} ${(onRowClick || (isMobile && columns.some(c => c.hideBelow))) ? 'cursor-pointer' : ''} ${rowClassName?.(row) || ''}`}
                  >
                    {columns.map((col, cIdx) => (
                      <td key={col.key} className={`whitespace-nowrap px-4 py-3 ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.hideBelow ? HIDE_CLASS[col.hideBelow] : ''}`}>
                        {cIdx === 0 && isMobile && columns.some(c => c.hideBelow) && (
                          <ChevronRight className={`inline-block w-4 h-4 mr-2 transition-transform ${expandedRow === i ? 'rotate-90' : ''}`} />
                        )}
                        {col.render ? col.render(row[col.key], row, page * pageSize + i) : (row[col.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                  {expandedRow === i && isMobile && (
                    <tr className="bg-muted/10 border-b border-border">
                      <td colSpan={columns.length} className="px-4 py-3">
                        <div className="flex flex-col gap-2 pl-6">
                          {columns.filter(c => c.hideBelow).map(col => (
                            <div key={col.key} className="flex justify-between items-start border-b border-border/50 pb-2 last:border-0 last:pb-0">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{col.label}</span>
                              <span className="text-right text-xs">
                                {col.render ? col.render(row[col.key], row, page * pageSize + i) : (row[col.key] ?? '—')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
      {footer}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          <span>Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, data.length)} of {data.length}</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="rounded-md border border-border px-3 py-1 font-sans text-xs font-bold uppercase tracking-wider hover:bg-muted/50 group hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors">Prev</button>
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="rounded-md border border-border px-3 py-1 font-sans text-xs font-bold uppercase tracking-wider hover:bg-muted/50 group hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
