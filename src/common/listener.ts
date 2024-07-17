import * as vscode from 'vscode';
import { LanguageClient, ExecuteCommandRequest } from 'vscode-languageclient/node';
import { registerLogger, traceError, traceLog, traceVerbose } from './log/logging';


let last_hints_generation = Date.now();
let last_python_uri: vscode.Uri | undefined;
let scheduled: boolean = false;
let generate_imports: boolean = true; // first time always generate imports

function reset_state() {
	traceLog(`Resetting state`);
	last_hints_generation = Date.now();
	scheduled = false;
	last_python_uri = undefined;
	generate_imports = false;
}

function try_generate_hints() {
	traceLog(`Try Generating hints ${last_python_uri} ${scheduled} ${last_hints_generation}`);
	if (last_python_uri) {
		let activeEditor = vscode.window.activeTextEditor;
		if (activeEditor && activeEditor.document.uri == last_python_uri) {
			reset_state();
			vscode.commands.executeCommand(`pyvoice.get_spoken`, "$file_uri", "$position");
		}
	}
}

export async function schedule_hints_generation(document: vscode.TextDocument, should_generate_imports: boolean) {
	if (document.languageId === "python") {
		last_python_uri = document.uri;
		generate_imports = generate_imports || should_generate_imports;


		if (Date.now() - last_hints_generation < 3000) {
			if (scheduled) {
				return;
			}
			scheduled = true;
			traceLog(`Scheduling hints generation`);
			setTimeout(try_generate_hints, 3000 - (Date.now() - last_hints_generation));
		} else {
			traceLog(`No wait for hints`);
			try_generate_hints();
		}
	}
}






