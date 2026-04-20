// Shared ASCII/Hex/Binary/Decimal conversion table overlay
// Used by Level 2 (hex) and Level 3 (protocols).

import { fullASCIITable } from '../utils/encoding.js';

/**
 * Render an ASCII table into a container element.
 * Optionally highlight a specific char code.
 *
 * @param {HTMLElement} container
 * @param {number|null} highlightCode  - decimal code to highlight
 */
export function renderASCIITable(container, highlightCode = null) {
  const rows = fullASCIITable();

  const wrap = document.createElement('div');
  wrap.className = 'ascii-table-wrap';

  const table = document.createElement('table');
  table.className = 'conv-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Char</th>
        <th>Dec</th>
        <th>Hex</th>
        <th>Binary</th>
      </tr>
    </thead>`;

  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    if (highlightCode !== null && row.decimal === highlightCode) {
      tr.style.background = '#00b4ff18';
    }
    tr.innerHTML = `
      <td class="conv-char">${escapeHtml(row.char)}</td>
      <td class="conv-dec">${row.decimal}</td>
      <td class="conv-hex">${row.hex}</td>
      <td class="conv-bin">${row.binary}</td>`;
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
  container.appendChild(wrap);
}

/**
 * Create a collapsible ASCII table widget with a toggle button.
 *
 * @param {HTMLElement} container  - element to append into
 * @param {string} [btnLabel]
 * @returns {{ highlight: (code: number) => void, remove: () => void }}
 */
export function createASCIITableWidget(container, btnLabel = 'ASCII Table') {
  const wrapper = document.createElement('div');
  wrapper.style.marginTop = '0.75rem';

  const toggle = document.createElement('button');
  toggle.className = 'btn btn--ghost';
  toggle.style.marginBottom = '0.5rem';
  toggle.textContent = btnLabel;

  const tableHolder = document.createElement('div');
  tableHolder.hidden = true;

  toggle.addEventListener('click', () => {
    tableHolder.hidden = !tableHolder.hidden;
    toggle.textContent = tableHolder.hidden ? btnLabel : 'Hide Table';
  });

  renderASCIITable(tableHolder);

  wrapper.appendChild(toggle);
  wrapper.appendChild(tableHolder);
  container.appendChild(wrapper);

  function highlight(code) {
    tableHolder.hidden = false;
    toggle.textContent = 'Hide Table';
    const rows = tableHolder.querySelectorAll('tbody tr');
    rows.forEach((tr, i) => {
      tr.style.background = (i + 32 === code) ? '#00b4ff18' : '';
    });
    // Scroll to highlighted row
    const idx = code - 32;
    if (idx >= 0 && idx < rows.length) {
      rows[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  return {
    highlight,
    remove: () => wrapper.remove(),
  };
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
