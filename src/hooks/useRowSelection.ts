import { useState, useCallback, useMemo } from "react";

export function useRowSelection<T extends string = string>() {
  const [selectedIds, setSelectedIds] = useState<Set<T>>(new Set());

  const isSelected = useCallback(
    (id: T) => selectedIds.has(id),
    [selectedIds]
  );

  const toggle = useCallback((id: T) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback((allIds: T[]) => {
    setSelectedIds((prev) => {
      const allSelected = allIds.length > 0 && allIds.every((id) => prev.has(id));
      if (allSelected) {
        return new Set<T>();
      }
      return new Set(allIds);
    });
  }, []);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isAllSelected = useCallback(
    (allIds: T[]) => allIds.length > 0 && allIds.every((id) => selectedIds.has(id)),
    [selectedIds]
  );

  const isIndeterminate = useCallback(
    (allIds: T[]) => {
      const selectedCount = allIds.filter((id) => selectedIds.has(id)).length;
      return selectedCount > 0 && selectedCount < allIds.length;
    },
    [selectedIds]
  );

  return useMemo(
    () => ({
      selectedIds,
      isSelected,
      toggle,
      toggleAll,
      clear,
      isAllSelected,
      isIndeterminate,
      count: selectedIds.size,
    }),
    [selectedIds, isSelected, toggle, toggleAll, clear, isAllSelected, isIndeterminate]
  );
}
