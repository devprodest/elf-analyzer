export type MessageType = 'get-info' | 'navigate' | 'update';

export type MessageBody = {
    type: MessageType;
    value?: string;
}


export const sendMessage = async (message: MessageBody) =>
    // @ts-ignore
    vscode.postMessage(message);
