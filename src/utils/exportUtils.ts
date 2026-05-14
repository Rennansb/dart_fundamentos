import * as XLSX from 'xlsx';
import { formatDateBRT } from './dateUtils';

/**
 * Strips leading characters that could trigger formula execution in Excel/Google Sheets.
 * Prevents CSV Injection attacks.
 */
const sanitizeValue = (value: any): any => {
  if (typeof value === 'undefined' || value === null) return '';
  if (typeof value !== 'string') return value;
  const unsafeChars = ['=', '+', '-', '@'];
  if (unsafeChars.some(char => value.startsWith(char))) {
    return `'${value}`; // Prepend single quote to escape
  }
  return value;
};

/**
 * Production-ready Excel export utility with sanitization and basic auto-styling.
 */
export const exportToExcel = (data: any[], moduleName: string, sheetName: string = 'Relatório') => {
  try {
    if (!data || data.length === 0) return;

    // 1. Sanitize Data
    const sanitizedData = data.map(row => {
      const newRow: any = {};
      Object.keys(row).forEach(key => {
        newRow[key] = sanitizeValue(row[key]);
      });
      return newRow;
    });

    // 2. Create Workbook and Worksheet
    const ws = XLSX.utils.json_to_sheet(sanitizedData);
    const wb = XLSX.utils.book_new();

    // 3. Auto-calculate Column Widths
    const colWidths = Object.keys(sanitizedData[0] || {}).map(key => {
      const headerLength = key.length;
      const maxLength = Math.max(
        headerLength,
        ...sanitizedData.map(row => String(row[key] || '').length)
      );
      return { wch: Math.min(maxLength + 2, 50) }; // Cap at 50 chars
    });
    ws['!cols'] = colWidths;

    // 4. Append and Write
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    // Standardized filename: Module_YYYY-MM-DD.xlsx
    const fileName = `ServiceHub_${moduleName}_${formatDateBRT(new Date())}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
  } catch (error) {
    console.error("Excel Export Error:", error);
  }
};
