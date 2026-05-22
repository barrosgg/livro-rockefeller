/* Util mínimo para gerar CSV (RFC 4180-ish) e dispará-lo como download. */

export function toCsv(rows, columns) {
  // columns: [{ key, label }] ou [string] (key = label)
  const cols = columns.map(c => typeof c === 'string' ? { key: c, label: c } : c);
  const header = cols.map(c => escape(c.label)).join(',');
  const body = rows.map(r =>
    cols.map(c => escape(formatVal(r[c.key]))).join(',')
  ).join('\n');
  return header + '\n' + body;
}

function formatVal(v) {
  if (v == null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function escape(s) {
  const str = String(s ?? '');
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function downloadCsv(filename, csvText) {
  const blob = new Blob(['﻿' + csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
