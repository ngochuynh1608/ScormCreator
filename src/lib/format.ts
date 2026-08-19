export function formatBytes(bytes: number): string {
  const n = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) {
    return `${(n / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} KB`;
  }
  if (n < 1024 * 1024 * 1024) {
    return `${(n / (1024 * 1024)).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`;
  }
  return `${(n / (1024 * 1024 * 1024)).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} GB`;
}

/** Plan field `maxStudents` is storage quota in megabytes. */
export function storageLimitBytes(maxStorageMb: number): number {
  return Math.max(0, Math.floor(maxStorageMb || 0)) * 1024 * 1024;
}

export function formatStorageMb(maxStorageMb: number): string {
  const mb = Math.max(0, Math.floor(maxStorageMb || 0));
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${gb.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} GB`;
  }
  return `${mb.toLocaleString("vi-VN")} MB`;
}
