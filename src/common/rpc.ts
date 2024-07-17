//  on unix the multiprocessing.connection is going to prepend 4 bytes
//  with the length of the payload
//  we need to adjust accordingly with custom method for write


function write_client(client: { once?: any; write: any; }, payload: Buffer | string) {
    var os = require('os');
    if (os.platform() == "win32") {
        client.write(payload);
    }
    else {
        var length = Buffer.alloc(4);
        if (typeof payload == "string") {
            payload = Buffer.from(payload);
        }
        length.writeInt32BE(payload.length);
        client.write(length);
        client.write(payload);
    }
}

function read_data(data: Buffer) {
    var os = require('os');
    if (os.platform() == "win32") {
        return data;
    }
    else {
        return data.slice(4);
    }
}



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
        write_client(client, digest);
        client.once("data", function (data: Buffer) {
            data = read_data(data);
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
    write_client(client, full_message);
    client.once("data", function (data) {
        data = read_data(data);
        var digest = crypto.createHmac('md5', authkey).update(message).digest();
        if (Buffer.compare(digest, data) != 0) {
            throw new Error(`dgigest received ws wrong ${digest} != ${data.toString()}`);
        }
        write_client(client, "#WELCOME#");
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
        write_client(client, JSON.stringify(msg));
        client.end();
    });
}

export function send_voicerpc_request(service: string, command: string, params: any, callback: any) {
    var client = get_client(service, function (client) {
        var msg = { "jsonrpc": "2.0", "method": command, "params": params }
        write_client(client, JSON.stringify(msg));
        client.once("data", function (data: Buffer) {
            data = read_data(data);
            callback(data);
            client.end();
        });
    });
}


