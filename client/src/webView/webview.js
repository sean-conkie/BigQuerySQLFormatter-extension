// webview.js

// Get a reference to the VS Code API
const vscode = acquireVsCodeApi();

// Listen for messages from the extension
window.addEventListener('message', event => {
  const message = event.data;
  switch (message.command) {
    case 'updateDataGrid':
      updateDataGrid(message.data);
      break;
    // Handle other commands if needed
  }
});

// Function to update the data grid
function updateDataGrid(data) {
  const dataGrid = document.getElementById('basic-grid');
  if (!dataGrid) {
    console.error('Data grid element not found');
    return;
  }

  // Clear existing content
  dataGrid.innerHTML = '';

  // Create header row
  const headerRow = document.createElement('vscode-data-grid-row');
  headerRow.rowType = 'header';
  const columns = Object.keys(data[0] || {});
  columns.forEach(columnName => {
    const headerCell = document.createElement('vscode-data-grid-cell');
    headerCell.cellType = 'columnheader';
    headerCell.textContent = columnName;
    headerRow.appendChild(headerCell);
  });
  dataGrid.appendChild(headerRow);

  // Create data rows
  data.forEach(item => {
    const row = document.createElement('vscode-data-grid-row');
    columns.forEach(columnName => {
      const cell = document.createElement('vscode-data-grid-cell');
      cell.textContent = item[columnName];
      row.appendChild(cell);
    });
    dataGrid.appendChild(row);
  });
}