import { Disposable, Webview, WebviewPanel, window, Uri, ViewColumn } from "vscode";
import { getUri, getNonce } from "./utils";

/**
 * This class manages the state and behavior of DataGrid webview panels.
 *
 * It contains all the data and methods for:
 *
 * - Creating and rendering DataGrid webview panels
 * - Properly cleaning up and disposing of webview resources when the panel is closed
 * - Setting the HTML (and by proxy CSS/JavaScript) content of the webview panel
 */
export class DataGridPanel {
  public static currentPanel: DataGridPanel | undefined;
  private readonly _panel: WebviewPanel;
  private _disposables: Disposable[] = [];

  /**
   * The DataGridPanel class private constructor (called only from the render method).
   *
   * @param panel A reference to the webview panel
   * @param extensionUri The URI of the directory containing the extension
   */
  private constructor(panel: WebviewPanel, extensionUri: Uri, data: any[] | null = null) {
    this._panel = panel;

    // Set an event listener to listen for when the panel is disposed (i.e. when the user closes
    // the panel or when the panel is closed programmatically)
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Set the HTML content for the webview panel
    this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri, data);
  }

  /**
   * Renders the current webview panel if it exists otherwise a new webview panel
   * will be created and displayed.
   *
   * @param extensionUri The URI of the directory containing the extension.
   */
  public static render(extensionUri: Uri, data: any[] | null = null) {
    if (DataGridPanel.currentPanel) {
      // If the webview panel already exists reveal it
      DataGridPanel.currentPanel._panel.reveal(ViewColumn.One);
    } else {
      // If a webview panel does not already exist create and show a new one
      const panel = window.createWebviewPanel(
        // Panel view type
        "showDataGrid",
        // Panel title
        "Query Results",
        // The editor column the panel should be displayed in
        ViewColumn.One,
        // Extra panel configurations
        {
          // Enable JavaScript in the webview
          enableScripts: true,
          // Restrict the webview to only load resources from the `out` directory
          localResourceRoots: [
            Uri.joinPath(extensionUri, "out"),
            Uri.joinPath(extensionUri, "node_modules", "@vscode", "webview-ui-toolkit", "dist")
          ],
        }
      );

      DataGridPanel.currentPanel = new DataGridPanel(panel, extensionUri, data);
    }
  }

  /**
   * Cleans up and disposes of webview resources when the webview panel is closed.
   */
  public dispose() {
    DataGridPanel.currentPanel = undefined;

    // Dispose of the current webview panel
    this._panel.dispose();

    // Dispose of all disposables (i.e. commands) associated with the current webview panel
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Defines and returns the HTML that should be rendered within the webview panel.
   *
   * @remarks This is also the place where *references* to CSS and JavaScript files
   * are created and inserted into the webview HTML.
   *
   * @param webview A reference to the extension webview
   * @param extensionUri The URI of the directory containing the extension
   * @returns A template string literal containing the HTML that should be
   * rendered within the webview panel
   */
  private _getWebviewContent(webview: Webview, extensionUri: Uri, data: any[] | null = null) {
    const webviewUri = getUri(webview, extensionUri, ["out", "webView", "webview.js"]);
    // Get the URI to the webview UI toolkit JavaScript bundle
    const toolkitUri = getUri(webview, extensionUri, [
      'node_modules',
      '@vscode',
      'webview-ui-toolkit',
      'dist',
      'toolkit.js',
    ]);
    const nonce = getNonce();

    // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
    return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
					<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
          <title>Query Results</title>
          <script type="module" nonce="${nonce}" src="${toolkitUri}"></script>
        </head>
        <body>
          <h1>Query Results</h1>
          <vscode-data-grid role="grid" grid-template-columns="repeat(auto-fit, minmax(100px, 1fr))" aria-label="Basic" generate-header="default">
            <vscode-data-grid-row role="row" class="header" row-type="header" grid-template-columns="1fr 1fr 1fr 1fr" style="grid-template-columns: 1fr 1fr 1fr 1fr;">
              ${data ? this._createDataGridHeader(data) : ""}
            </vscode-data-grid-row>
            ${data ? this._createDataGridRow(data) : ""}
          </vscode-data-grid>
        </body>
      </html>
    `;
  }

  private _createDataGridHeader(data: any[]): string {

    if (data.length > 0) {
      return Object.keys(data[0])
        .map((header: any, index: number) => {
          return /*html*/ `<vscode-data-grid-cell class="column-header" cell-type="columnheader" grid-column="${index + 1}" grid-template-columns="1fr 1fr 1fr 1fr" style="grid-template-columns: 1fr 1fr 1fr 1fr;">${header}</vscode-data-grid-cell>`;
        })
        .join('');
    }
    return '';
  }

  private _createDataGridRow(data: any[]): string {
    return data.map((row: any) => {
      const rowData = Object.values(row).map((cell: any, index: number) => {
        return /*html*/ `<vscode-data-grid-cell role="gridcell" style="grid-column: 1;" grid-column="${index + 1}">${cell}</vscode-data-grid-cell>`;
      });
      return /*html*/ `<vscode-data-grid-row role="row" row-type="default" grid-template-columns="1fr 1fr 1fr 1fr" style="grid-template-columns: 1fr 1fr 1fr 1fr;">${rowData.join('')}</vscode-data-grid-row>`;
    }).join('');
  }
}