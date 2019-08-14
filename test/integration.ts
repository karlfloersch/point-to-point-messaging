import assert from "assert";
import temp from "temp";
import pify from "pify";

import { Server } from "..";
import { Client } from "..";
import { IMessage } from "..";

// clean up temp files/dirs when done
temp.track();
const mktmp = pify(temp.mkdir);

// tslint:disable-next-line: interface-name
interface Identity {
  address: string;
}

// tslint:disable-next-line: interface-name
interface FakeEncryptedMessage {
  plaintext: string;
}

describe("end-to-end integration", () => {
  let server: Server<FakeEncryptedMessage>;
  const numClients = 5;
  const clients: Array<Client<FakeEncryptedMessage>> = [];
  const identities: Identity[] = [];

  beforeAll(async () => {
    const dbPath = await mktmp("end-to-end-test");
    server = new Server<FakeEncryptedMessage>(dbPath);

    for (let i = 0; i < numClients; i++) {
      identities.push({
        address: `000000000000000000000000000000000000000${i}`
      });
      const client = new Client<FakeEncryptedMessage>("http://127.0.0.1:8000");
      clients.push(client);
    }
  });

  test("subscribe", async () => {
    for (let i = 0; i < numClients; i++) {
      clients[i].subscribe(identities[i].address);
    }
  });

  test("send to everyone", async () => {
    let messageCount = 0;
    const messages: { [index: string]: IMessage<FakeEncryptedMessage> } = {};

    const promises = [];

    // for clients 1..n, take the first message they receive and dump it into
    // the messages array
    for (let i = 1; i < numClients; i++) {
      promises.push(new Promise((accept) => {
        clients[i].once("message", (message: IMessage<FakeEncryptedMessage>) => {
          messageCount++;
          messages[identities[i].address] = message;
          accept();
        });
      }));
    }

    // have the 0th client send a unique message to clients 1..n
    for (let i = 1; i < numClients; i++) {
      const fakeEncryptedMessage = {
        plaintext: `Hello there client 0x${identities[i].address}!`,
      }

      const message: IMessage<FakeEncryptedMessage> = {
        to: identities[i].address,
        message: fakeEncryptedMessage,
      };

      clients[0].sendMessage(message);
    }

    await Promise.all(promises);

    assert.strictEqual(messageCount, numClients - 1);

    for (let i = 1; i < numClients; i++) {
      const fakeDecryptedMessage = messages[identities[i].address].message.plaintext;

      assert.strictEqual(fakeDecryptedMessage, `Hello there client 0x${identities[i].address}!`);
    }
  });

  afterAll(() => {
    for (let i = 0; i < numClients; i++) {
      clients[0].close();
    }

    server.close();
  });
});
