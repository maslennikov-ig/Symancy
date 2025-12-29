/**
 * CSV Export Utility for Admin Panel
 * Exports data arrays to downloadable CSV files
 */

/**
 * Export data to CSV file
 * @param data - Array of objects to export
 * @param filename - Name of the file (without extension)
 * @param columns - Column definitions with header and accessor
 */
export function exportToCsv<T extends object>(
  data: T[],
  filename: string,
  columns: Array<{
    header: string;
    accessor: keyof T | ((item: T) => string | number | null | undefined);
  }>
): void {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Build header row
  const headers = columns.map((col) => `"${col.header}"`).join(',');

  // Build data rows
  const rows = data.map((item) => {
    return columns
      .map((col) => {
        let value: string | number | null | undefined;

        if (typeof col.accessor === 'function') {
          value = col.accessor(item);
        } else {
          value = item[col.accessor] as string | number | null | undefined;
        }

        // Handle null/undefined
        if (value == null) return '""';

        // Escape quotes and wrap in quotes
        const stringValue = String(value).replace(/"/g, '""');
        return `"${stringValue}"`;
      })
      .join(',');
  });

  // Combine and create blob with BOM for Excel UTF-8 support
  const csvContent = [headers, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;

  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Cleanup
  URL.revokeObjectURL(url);
}
