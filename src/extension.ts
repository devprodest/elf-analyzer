import * as vscode from 'vscode';
import { ElfEditorProvider } from './ElfEditorProvider';


export const logChannel = vscode.window.createOutputChannel('devprodest-elf-analyzer', { log: true });

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(ElfEditorProvider.register(context));
}

export function deactivate() {}
