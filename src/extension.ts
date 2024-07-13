// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { LanguageClient, ExecuteCommandRequest } from 'vscode-languageclient/node';
import { registerLogger, traceError, traceLog, traceVerbose } from './common/log/logging';
import {
    checkVersion,
    getInterpreterDetails,
    initializePython,
    onDidChangePythonInterpreter,
    resolveInterpreter,
} from './common/python';
import { restartServer } from './common/server';
import { checkIfConfigurationChanged, getInterpreterFromSetting } from './common/settings';
import { loadServerDefaults } from './common/setup';
import { getLSClientTraceLevel } from './common/utilities';
import { createOutputChannel, onDidChangeConfiguration, registerCommand } from './common/vscodeapi';

import { send_voicerpc_notification } from "./common/rpc";
import { schedule_hints_generation } from "./common/listener";


let last_tick = Date.now();
let lsClient: LanguageClient | undefined;
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // This is required to get server name and module. This should be
    // the first thing that we do in this extension.
    const serverInfo = loadServerDefaults();
    const serverName = serverInfo.name;
    const serverId = serverInfo.module;

    // Setup logging
    const outputChannel = createOutputChannel(serverName);
    context.subscriptions.push(outputChannel, registerLogger(outputChannel));

    const changeLogLevel = async (c: vscode.LogLevel, g: vscode.LogLevel) => {
        const level = getLSClientTraceLevel(c, g);
        await lsClient?.setTrace(level);
    };

    context.subscriptions.push(
        outputChannel.onDidChangeLogLevel(async (e) => {
            await changeLogLevel(e, vscode.env.logLevel);
        }),
        vscode.env.onDidChangeLogLevel(async (e) => {
            await changeLogLevel(outputChannel.logLevel, e);
        }),
    );

    // Log Server information
    traceLog(`Name: ${serverInfo.name}`);
    traceLog(`Module: ${serverInfo.module}`);
    traceVerbose(`Full Server Info: ${JSON.stringify(serverInfo)}`);

    const runServer = async () => {
        const interpreter = getInterpreterFromSetting(serverId);
        if (interpreter && interpreter.length > 0) {
            traceVerbose(`Using interpreter from ${serverInfo.module}.interpreter: ${interpreter.join(' ')}`);
            lsClient = await restartServer(serverId, serverName, outputChannel, lsClient);
            lsClient?.onNotification("voice/sendRpc", (params) => {
                send_voicerpc_notification("default", params.command, params.params);
            });
            return;
        }

        const interpreterDetails = await getInterpreterDetails();
        if (interpreterDetails.path) {
            traceVerbose(`Using interpreter from Python extension: ${interpreterDetails.path.join(' ')}`);
            lsClient = await restartServer(serverId, serverName, outputChannel, lsClient);
            lsClient?.onNotification("voice/sendRpc", (params) => {
                send_voicerpc_notification("default", params.command, params.params);
            });
            return;
        }

        traceError(
            'Python interpreter missing:\r\n' +
            '[Option 1] Select python interprete using the ms-python.python.\r\n' +
            `[Option 2] Set an interpreter using "${serverId}.interpreter" setting.\r\n` +
            'Please use Python 3.8 or greater.',
        );
    };

    context.subscriptions.push(
        onDidChangePythonInterpreter(async () => {
            await runServer();
        }),
        onDidChangeConfiguration(async (e: vscode.ConfigurationChangeEvent) => {
            if (checkIfConfigurationChanged(e, serverId)) {
                await runServer();
            }
        }),
        registerCommand(`${serverId}.restart`, async () => {
            await runServer();
        }),

        // pyvoice stuff
        vscode.window.onDidChangeActiveTextEditor((e) => {
            if (e?.document) {
                schedule_hints_generation(e.document);
            }
        }),
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document) {
                schedule_hints_generation(e.document);
            }
        }),
        registerCommand(`${serverId}.get_spoken`, async () => {
            var editor = vscode.window.activeTextEditor;
            if (typeof editor === 'undefined') {
                return;
            }
            lsClient?.sendRequest("workspace/executeCommand", {
                command: "get_spoken",
                arguments: [
                    lsClient?.code2ProtocolConverter.asTextDocumentIdentifier(editor?.document).uri,
                    editor?.selections.map((it) => lsClient?.code2ProtocolConverter.asRange(it))[0]?.start
                ]
            })
        }),
        // register command that executes a given command on the language3 server
        // arguments $file_uri and $position should be expanded by the command
        registerCommand(`${serverId}.lsp_execute`, async (command_name: string, command_args: any[]) => {
            traceLog("lsp_execute", command_name, command_args);
            var editor = vscode.window.activeTextEditor;
            if (typeof editor === 'undefined') {
                return;
            }
            const expand_args = (arg: any) => {
                if (typeof editor === 'undefined') {
                    return arg;
                } 
                if (arg === "$file_uri") {
                    return lsClient?.code2ProtocolConverter.asTextDocumentIdentifier(editor.document).uri;
                } else if (arg === "$position") {
                    return editor?.selections.map((it) => lsClient?.code2ProtocolConverter.asRange(it))[0]?.start;
                } else {
                    return arg;
                }
            }
            var args = command_args.map(expand_args);
            traceLog("lsp_execute", command_name, args);

            lsClient?.sendRequest("workspace/executeCommand", {
                command: command_name,
                arguments: args
            });
        }),
    );

    setImmediate(async () => {
        const interpreter = getInterpreterFromSetting(serverId);
        if (interpreter === undefined || interpreter.length === 0) {
            traceLog(`Python extension loading`);
            await initializePython(context.subscriptions);
            traceLog(`Python extension loaded`);
        } else {
            await runServer();
        }
    });
}

export async function deactivate(): Promise<void> {
    if (lsClient) {
        await lsClient.stop();
    }
}
