import * as vscode from 'vscode';
import { getNonce } from './util';
import { getElfInfo } from './ElfInformation';
import { logChannel } from './extension';




export class ElfEditorProvider implements vscode.CustomReadonlyEditorProvider {

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new ElfEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(ElfEditorProvider.viewType, provider);
        return providerRegistration;
    }

    private static readonly viewType = 'devprodest-elf-analyzer.elf-view';


    constructor(
        private readonly context: vscode.ExtensionContext,
    ) { }

    openCustomDocument(uri: vscode.Uri): vscode.CustomDocument | Thenable<vscode.CustomDocument> {
        return {
            uri,
            dispose: (): void => { },
        };
    }

    public async resolveCustomEditor(document: vscode.CustomDocument, webviewPanel: vscode.WebviewPanel, token: vscode.CancellationToken): Promise<void> {
        const assetsPath = vscode.Uri.joinPath(this.context.extensionUri, 'view-dist', 'assets');

        webviewPanel.webview.options = {
            enableScripts: true,
            enableCommandUris: true,
            localResourceRoots: [assetsPath],
        };

        webviewPanel.webview.onDidReceiveMessage(async (message) => {
            logChannel.info("onDidReceiveMessage", message);
            switch (message.type) {
                case 'reopen-as-text':
                    vscode.commands.executeCommand('vscode.openWith', document.uri, 'default', webviewPanel.viewColumn);
                    break;
                case 'get-info':
                    updateWebview();
                    break;
                case 'navigate':
                    await this.tryOpenFileWithLine(message.value);
                    break;
                case 'export-csv':
                    await vscode.window.showSaveDialog({
                        filters: { 'CSV Files': ['csv'] },
                        defaultUri: vscode.Uri.file(document.uri.fsPath.replace(/\.elf$/, '.csv'))
                    }).then(async (uri) => {
                        if (uri) {
                            await vscode.workspace.fs.writeFile(uri, Buffer.from(message.value, 'utf-8'));
                            vscode.window.showInformationMessage('CSV exported successfully!');
                        }
                    });
                    break;
                case 'compare-elf':
                    const selected = await vscode.window.showOpenDialog({
                        canSelectFiles: true,
                        canSelectFolders: false,
                        filters: { 'ELF Files': ['elf', 'axf', 'out'] }
                    });
                    if (selected && selected.length > 0) {
                        const oldInfo = await getElfInfo(selected[0].fsPath);
                        webviewPanel.webview.postMessage({
                            type: 'compare-result',
                            value: JSON.stringify(oldInfo),
                        });
                    }
                    break;
            }
        });

        async function updateWebview() {
            const config = vscode.workspace.getConfiguration('devprodest-elf-analyzer');
            webviewPanel.webview.postMessage({
                type: 'update',
                value: JSON.stringify(await getElfInfo(document.uri.fsPath)),
                settings: {
                    showCharts: config.get<boolean>('show-charts', true),
                    showTop15: config.get<boolean>('show-top-15', true),
                }
            });
        }

        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(async (e) => {
            if (e.document.uri.toString() === document.uri.toString()) {
                updateWebview();
            }
        });

        // --- НОВОЕ: Следим за пересборкой фронтенда ---
        const updateHtml = () => {
            webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, assetsPath);
        };

        updateHtml(); // Устанавливаем HTML

        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(this.context.extensionUri, 'view-dist/**/*')
        );
        watcher.onDidChange(updateHtml);
        watcher.onDidCreate(updateHtml);

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
            watcher.dispose();
        });

        // Вызываем после того, как HTML установлен
        await updateWebview();
    }

    getHtmlForWebview(webview: vscode.Webview, assetsPath: vscode.Uri): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsPath, 'index.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsPath, 'index.css'));
        const nonce = getNonce();

        return /* html */ `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:;">
            <link href="${styleUri}" rel="stylesheet" />
        </head>
        <body>
            <div id="app"></div>
            <script nonce="${nonce}">const vscode = acquireVsCodeApi();</script>
            <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
    }


    private async tryOpenFileWithLine(filePath: string) {
        const fileinfo = filePath.match(/(.*):(\d*)/);
        const file = fileinfo?.[1].toString() || "";
        const line: number = Number.parseInt(fileinfo?.[2] || "0");

        logChannel.info("openFileWithLine", file, line);

        const editor = await vscode.window.showTextDocument(vscode.Uri.file(file));

        const gotoPosition = new vscode.Position((line || 1) - 1, 0);
        editor.selection = new vscode.Selection(gotoPosition, gotoPosition);
        editor.revealRange(
            new vscode.Range(gotoPosition, gotoPosition),
            vscode.TextEditorRevealType.InCenter
        );
    }
}
