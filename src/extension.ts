import * as vscode from 'vscode';
import { ElfEditorProvider } from './ElfEditorProvider';


export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(ElfEditorProvider.register(context));
}

export function deactivate() {}
