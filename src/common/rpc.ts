function get_server_path(service: string) {
    var os = require('os');
    var path = require('path');
    if (os.platform() == "win32") {
        const home_name = os.homedir().split("\\").pop();
        return path.join("\\\\.\\pipe\\voicerpc", home_name, service);
    }
    else {
        return path.join(os.homedir(), '.voicerpc', service + '.sock');
    }
}

function answer_challenge(client: { once: any; write: any; }, authkey: Buffer, callback: { (client: any): void; (client: any): void; (arg0: any): void; }) {
    var hmac = require('crypto');
    client.once("data", function (data: Buffer) {
        var message = data.slice(-20);
        var digest = hmac.createHmac('md5', authkey).update(message).digest();
        client.write(digest);
        client.once("data", function (data: Buffer) {
            if (data.toString() != "#WELCOME#") {
                throw new Error("digest sent was rejected");
            }
            deliver_challenge(client, authkey, callback);
        })
    })
}

function deliver_challenge(client: { write: (arg0: string | Buffer) => void; once: (arg0: string, arg1: (data: any) => void) => void; }, authkey: any, callback: (arg0: any) => void) {
    var crypto = require('crypto');
    var message = crypto.randomBytes(20);
    var full_message = Buffer.concat([Buffer.from("#CHALLENGE#", "ascii"), message]);
    client.write(full_message);
    client.once("data", function (data) {
        var digest = crypto.createHmac('md5', authkey).update(message).digest();
        if (Buffer.compare(digest, data) != 0) {
            throw new Error(`dgigest received ws wrong ${digest} != ${data.toString()}`);
        }
        client.write("#WELCOME#");
        callback(client);
    });
}

function get_client(service: string, callback: { (client: any): void; (client: any): void; }) {
    var fs = require('fs');
    var os = require('os');
    var path = require('path');
    var credentials = JSON.parse(fs.readFileSync(
        path.join(os.homedir(), '.voicerpc.json'), 
        'utf8')
    );
    var encoded_auth = credentials[service];
    var auth = Buffer.from(encoded_auth, 'base64');
    var address = get_server_path(service);
    var net = require('net');
    var client = net.connect({ path: address }, function () {
        answer_challenge(client, auth, callback);
    });
    return client;
};


export function send_voicerpc_notification(service: string, command: string, params: any) {
    var client = get_client(service, function (client) {
        var msg = { "jsonrpc": "2.0", "method": command, "params": params }
        client.write(JSON.stringify(msg));
        client.end();
    });
}

export function send_voicerpc_request(service: string, command: string, params: any, callback: any) {
    var client = get_client(service, function (client) {
        var msg = { "jsonrpc": "2.0", "method": command, "params": params }
        client.write(JSON.stringify(msg));
        client.once("data", callback);
        client.end();
    });
}


