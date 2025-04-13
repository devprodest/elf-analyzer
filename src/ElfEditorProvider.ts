import * as vscode from 'vscode';
import { getNonce } from './util';
import { getElfInfo } from './ElfInformation';




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
            localResourceRoots: [assetsPath],
        };

        webviewPanel.webview.onDidReceiveMessage((message) => {
            console.log(message);
            switch (message.type) {
                case 'reopen-as-text':
                    vscode.commands.executeCommand('vscode.openWith', document.uri, 'default', webviewPanel.viewColumn);
                    break;

                case 'getinfo':
                    updateWebview();
                    break;
            }
        }
        );

        async function updateWebview() {
            webviewPanel.webview.postMessage({
                type: 'update',
                text: JSON.stringify(await getElfInfo(document.uri.fsPath)),
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


    getHtmlForWebview(webview: vscode.Webview, assetsPath: vscode.Uri): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsPath, 'index.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsPath, 'index.css'));
        const nonce = getNonce();

        return /* html */ `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><link href="${styleUri}" rel="stylesheet" /><script>const vscode = acquireVsCodeApi();</script></head><body><div id="app"></div><script type="module" src="${scriptUri}"></script></body></html>`;
    }

}
