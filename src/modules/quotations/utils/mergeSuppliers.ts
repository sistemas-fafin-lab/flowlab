// Merges the parent-fetched supplier list with any suppliers just created inline
// (via SupplierFormModal) that haven't shown up in the parent list's next refetch yet.
export function mergeSuppliers<T extends { id: string }>(base: T[], extra: T[]): T[] {
  return [...base, ...extra.filter(e => !base.some(s => s.id === e.id))];
}
