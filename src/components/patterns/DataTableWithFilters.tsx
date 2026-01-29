"use client";

import { useState, useMemo, FC } from "react";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/base/buttons/button";
import { BulkActionBar } from "./BulkActionBar";

export interface Column<T> {
  id: string;
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

export interface BulkAction {
  label: string;
  icon?: FC<{ className?: string }> | React.ReactNode;
  onClick: (selectedIds: Set<string>) => void | Promise<void>;
  variant?: "default" | "destructive";
}

export interface RowAction<T> {
  label: string;
  icon?: FC<{ className?: string }> | React.ReactNode;
  onClick: (row: T) => void | Promise<void>;
  variant?: "default" | "destructive";
}

export interface DataTableWithFiltersProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  bulkActions?: BulkAction[];
  rowActions?: RowAction<T>[];
  emptyState?: React.ReactNode;
}

export function DataTableWithFilters<T extends { _id: string }>({
  data,
  columns,
  onRowClick,
  searchPlaceholder = "Search...",
  searchKeys,
  bulkActions,
  rowActions,
  emptyState,
}: DataTableWithFiltersProps<T>) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!search || !searchKeys) return data;

    const lowerSearch = search.toLowerCase();
    return data.filter((row) =>
      searchKeys.some((key) => {
        const value = row[key];
        return String(value).toLowerCase().includes(lowerSearch);
      })
    );
  }, [data, search, searchKeys]);

  // Handle row selection
  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredData.map((row) => row._id)));
    }
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      {searchKeys && (
        <div className="flex items-center gap-2">
          <Input
            type="search"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(value) => setSearch(value)}
            className="max-w-sm"
          />
        </div>
      )}

      {/* Bulk action bar */}
      {bulkActions && selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          actions={bulkActions}
          selectedIds={selectedIds}
          onClearSelection={() => setSelectedIds(new Set())}
        />
      )}

      {/* Simple table (will be enhanced later with actual DataTable component) */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {bulkActions && (
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredData.length && filteredData.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.id}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  {column.header}
                </th>
              ))}
              {rowActions && (
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (bulkActions ? 1 : 0) + (rowActions ? 1 : 0)} className="px-4 py-8 text-center">
                  {emptyState || <span className="text-gray-500">No data found</span>}
                </td>
              </tr>
            ) : (
              filteredData.map((row) => (
                <tr
                  key={row._id}
                  onClick={() => onRowClick?.(row)}
                  className={onRowClick ? "cursor-pointer hover:bg-gray-50" : ""}
                >
                  {bulkActions && (
                    <td className="w-12 px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row._id)}
                        onChange={() => handleSelectRow(row._id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-300"
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td key={column.id} className="px-4 py-4 text-sm text-gray-900">
                      {column.cell
                        ? column.cell(row)
                        : column.accessorKey
                        ? String(row[column.accessorKey])
                        : null}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {rowActions.map((action, index) => (
                          <Button
                            key={index}
                            size="sm"
                            color="tertiary"
                            iconLeading={action.icon}
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              action.onClick(row);
                            }}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
