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
            }
        }
        );

        async function updateWebview() {
            webviewPanel.webview.postMessage({
                type: 'update',
                value: JSON.stringify(await getElfInfo(document.uri.fsPath)),
            });
        }

        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(async (e) => {
            if (e.document.uri.toString() === document.uri.toString()) {
                updateWebview();
            }
        });
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });

        await updateWebview();

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, assetsPath);
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


    getHtmlForWebview(webview: vscode.Webview, assetsPath: vscode.Uri): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsPath, 'index.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsPath, 'index.css'));
        const nonce = getNonce();

        return /* html */ `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><link href="${styleUri}" rel="stylesheet" /><script>const vscode = acquireVsCodeApi();</script></head><body><div id="app"></div><script type="module" src="${scriptUri}"></script></body></html>`;
    }

}
