# Point-to-Point Messaging

This TypeScript module provides a client and server to be used for point-to-point messaging between networked clients. Clients may subscribe to messages sent to an arbitrary address. Messages sent while clients are offline are queued and delivered when the client connects and subscribes to messages at that address. All messages are persisted indefinitely in a LevelDB database stored to your local filesystem.

The client and server communicate via a socket.io channel.

## Server

The server can be run simply by running `npm start` or `yarn start` depending on which package manager you prefer. The server accepts a number of command line arguments to control its behavior. You can see a listing of these along with their descriptions by specifying the `-h` or `--help` argument when you run the server.

The current options supported are:

```
Options:
  --version       Show version number                                  [boolean]
  --port, -p      External port on which to listen      [number] [default: 8000]
  --dbPath, -d    Path which should be used for storing the LevelDB database
                   [string] [default: "$HOME/.config/point-to-point-messaging/database"]
  --hostname, -i  External ip address on which to listen
                                                 [string] [default: "127.0.0.1"]
  --logLevel, -l  Sets the verbosity of the logging output
                [choices: "debug", "info", "warning", "error"] [default: "info"]
  --jsonLogs, -j  If specified, makes log lines write out in JSON format
                                                                       [boolean]
  --help, -h      Show help                                            [boolean]
```

If you'd like to embed the server in your own application, you can include it with the following example:

```typescript
import { Server } from "point-to-point-messaging";

type MessageType = {
  // use this to determine the body of your messages
}

// the server starts listening as soon as it's constructed
const Server = new Server<MessageType> (
  pathToDatabaseDirectory, // required, path to the directory where the database should be stored
  hostname, // optional, hostname on which to listen, defaults to localhost
  port, // optional, port on which to listen, defaults to 8000
  logger // optional, a winston logger instance, should you want custom logging
);
```

## Client

See the below example for how to send and subscribe to messages.

### Creating a new client instance
```typescript

type MessageType = {
  // use this to determine the body of your messages
  // must match the structure of messages expected by the server
}

// adjust the URL for your particular server
const client = new Client<MessageType>("http://127.0.0.1:8000");
```

### Subscribing to messages

To subscribe to new incoming messages, first register your subscription with the server, then register an event handler with the client.

```typescript

// register the subscription with the server
client.subscribe(address);

// register an event handler for the message
client.on("message", (message) => { ... });
```

### Disconnecting from the server

When the client disconnects from the server, its subscriptions are destroyed. However messages sent to the client's registered address will be persisted on the server and the client will receive these messages the next time it connects.

```typescript
// closes connection with the server
client.close();
```

### Sending messages encrypted with Ethereum public keys

This client was written to support the development of applications which rely on sending messages that are encrypted for receipt by a specific Ethereum address holder. The example below shows how to accomplish this goal using the [eth-crypto](https://github.com/pubkey/eth-crypto) module.

```typescript

import EthCrypto, { Encrypted } from "eth-crypto";
import { Client, IMessage } from "point-to-point-messaging";

// address to which you want to send an encrypted message
const recipientPublicKey = "..."; // hex string, no leading "0x"
const recipientAddress = EthCrypto.publicKey.toAddress(recipientPublicKey);

// create the client
const client = new Client<Encrypted>(...);

//send an encrypted message
async function sendMessage() {
  const encryptedMessage = await EthCrypto.encryptWithPublicKey(
    recipientPublicKey,
    `Hello there, ${recipientAddress}!`,
  );
}
```

### Receiving messages encrypted with Ethereum public keys

Similar to above, messages encrypted with Ethereum public keys can be received and decrypted as in the following example:

```typescript

const privateKey = "..."; // hex encoded, no leading "0x"
const publicKey = EthCrypto.publicKeyByPrivateKey(privateKey);
const address = EthCrypto.publicKey.toAddress(publicKey);

const identity = {
  privateKey,
  publicKey,
  address,
} 

// receiving encrypted message
client.subscribe(address);
client.on("message", async (message: IMessage<Encrypted>) => {
  const decryptedMessage = await EthCrypto.decryptWithPrivateKey(message.message);
  console.out(decryptedMessage); // prints "Hello there, 0x...!"
});

```
