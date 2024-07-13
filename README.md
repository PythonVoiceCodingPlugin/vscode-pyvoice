# vscode-pyvoice

This is the vscode portion of [pyvoice](https://github.com/PythonVoiceCodingPlugin)


<div>
<img src="https://github.com/PythonVoiceCodingPlugin/assets/blob/main/pyvoice_logo.png" align="right" height=320 width=320/>
</div>

<!-- MarkdownTOC  autolink="true" -->

- [Features](#features)
- [Installation](#installation)
    - [Main Plug-In](#main-plug-in)
    - [Command server - handled automatically](#command-server---handled-automatically)
    - [Python interpreter](#python-interpreter)
        - [Manually specify interpreter in settings](#manually-specify-interpreter-in-settings)
        - [Optionally install the Microsoft Python extension](#optionally-install-the-microsoft-python-extension)
- [Limitations](#limitations)
- [Inter Process Communication And Security Considerations](#inter-process-communication-and-security-considerations)
    - [Receiving commands from the voice coding framework](#receiving-commands-from-the-voice-coding-framework)
    - [Sending commands to the voice coding framework](#sending-commands-to-the-voice-coding-framework)
    - [Server Security](#server-security)
- [Debugging](#debugging)
- [Logging and Logs](#logging-and-logs)

<!-- /MarkdownTOC -->

> [!WARNING]
> Prerelease status

# Features

This plugin is based on a [template from microsoft for python language servers](https://github.com/microsoft/vscode-python-tools-extension-template), which has been adapted to provide the following functionality

- it bundles the [pyvoice-language-server pypi package](https://pypi.org/project/pyvoice-language-server/) so that you do not have to install it manually

- it listens for user events, such as opening  a file, focusing a tab, editing its contents and appropriately triggers the server to generate hints mapping to their pronunciations items such as
    - expressions (properly formatted)
    - modules and symbols that can be imported


> [!NOTE]
> At the moment, the plug-in would not trigger regeneration of speech hints if you change the current selection. These would be changed the future, but for the time being those cases you can triggered it manually via a command pallete cmd [below](#commands) or a voice command `get spoken`

- it provides the custom notification handlers needed for receiving those speech hints

- it manages the communication with the programming by voice framework via IPC mechanism and forwards all necessary messages from the language server to the voice coding system

# Installation

## Main Plug-In

The main plug-in can be installed from the marketplace [here](https://marketplace.visualstudio.com/items?itemName=mpourmpoulis.pyvoice) or from the `.vsix` file available with each release

## Command server - handled automatically

The command server is a separate vscode [extension](https://marketplace.visualstudio.com/items?itemName=pokey.command-serve) responsible for receiving commands from the voice coding system. It is automatically installed as a dependency of the main plug-in.

## Python interpreter

in order to use the project, you must have at least one python interpreter installed on your machine with version >= 3.8 it is implemented as a pure python package. 

> [!NOTE]
> The interpreter you choose regardless of the method for running language_server process is also  the one to provide the default `sys.path` used for static analysis by [jedi](https://jedi.readthedocs.io/en/latest/docs/api.html#jedi.Script) if you do not set the `pyvoice.settings.project.environmentPath` setting.



### Manually specify interpreter in settings

You can manually specify the python interpreter you want to use for each workspace ( or globally per user) by adding the following to your settings.json

```json
{
    "pyvoice.interpreter": "/path/to/python"
}
```

### Optionally install the Microsoft Python extension

Alternatively, you can install the  [python extension from Microsoft](https://marketplace.visualstudio.com/items?itemName=ms-python.python) which will automatically detects your python interpreters and virtual environments and allows you to choose one of them.

The pyvoice extension will then use the interpreter you have selected in the Microsoft Python extension for executing the language server

# Limitations

Unfortunately, these plugin will not work when using vscode in remote mode (ssh, docker etc). That's because it needs access to the file system of both the machine where the workspace is located (in order to perform static analysis) as well as the machine where the UI is running ( due to the way IPC with the voice coding framework is implemented). In order to address this, a future release would most likely have to break up the extension in two parts.


# Inter Process Communication And Security Considerations

Receiving and sending commands to and from the voice coding system is intentionally split into two mechanisms

## Receiving commands from the voice coding framework

Commands to execute in vscode (like adding an import statement to a file) are sent from the voice coding framework via the [Command Server](https://marketplace.visualstudio.com/items?itemName=pokey.command-server) extensionm which employees a file-based RPC mechanism



## Sending commands to the voice coding framework

In order to transmit speech hints to the programming by voice system, an interprocess communication mechanism is employed utilizing `AF_UNIX` sockets on UNIX systems and `AF_PIPE` named pipes on Windows as transports with the format   being JSON-RPC 2.0. The programming by voice system binds those sockets or pipes as a listener/server and sublime connects as a client.

> [!NOTE]
> In order to keep implementation as simple and as stateless as possible, connections are intentionally short-lived, one per notification sent, and only target one voice system at a time.

> [!IMPORTANT]
> Implementation wise, the vscode ipc client, written in ***javascript***, is going to mimic the behaviour of ***python stdlib*** `multiprocessing.connection` machinery. The latter is used across the rest of the pyvoice ecosystem and more importantly also features a mechanism for authenticating both ends of the connection via cryptographic challenge based on a shared key. That is important because there exists a race condition where processes running with lower privileges may try to bind the named pipe on windows before the voice coding system does, thus causing sublime to talk to them instead.
> The shared key is generated by the voice system and is persisted in json file in the user's home directory, which should be out of reach for those low privilege user processes. That being said,due to the one way direction RPC is flowing, the attack surface should be pretty limited even without the auth mechanism


> [!WARNING]
> Unfortunately, the auth handshake employed by the python stdlib(3.8) is using HMAC-MD5. It is only python 3.12 that introduced support for stronger hash functions , while also extending the handshake protocol in a backwards compatible manner. As a consequence, the javascript code is also using hmac-md5... While not the end of the world, at some point this should be changed (ecosystem wide)

## Server Security

Please take a look at the [security considerations for the server as well](https://github.com/PythonVoiceCodingPlugin/pyvoice-language-server?tab=readme-ov-file#security-considerations)


# Debugging

To debug both TypeScript and Python code use `Debug Extension and Python` debug config. This is the recommended way. Also, when stopping, be sure to stop both the Typescript, and Python debug sessions. Otherwise, it may not reconnect to the python session.

To debug only TypeScript code, use `Debug Extension` debug config.

To debug a already running server or in production server, use `Python Attach`, and select the process that is running `lsp_server.py`.

# Logging and Logs

The template creates a logging Output channel that can be found under `Output` > `pyvoice` panel. You can control the log level running the `Developer: Set Log Level...` command from the Command Palette, and selecting your extension from the list. It should be listed using the display name for your tool. You can also set the global log level, and that will apply to all extensions and the editor.

If you need logs that involve messages between the Language Client and Language Server, you can set `"pyvoice.server.trace": "verbose"`, to get the messaging logs. These logs are also available `Output` > `pyvoice` panel.


