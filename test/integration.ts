import assert from "assert";
import temp from "temp";
import pify from "pify";
import EthCrypto, { Encrypted } from "eth-crypto";

import { Server } from "..";
import { Client } from "..";
import { IMessage } from "..";

// clean up temp files/dirs when done
temp.track();
const mktmp = pify(temp.mkdir);

// tslint:disable-next-line: interface-name
interface Identity {
  privateKey: string;
  publicKey: string;
  address: string;
}

describe("end-to-end integration", () => {
  let server: Server<Encrypted>;
  const numClients = 5;
  const clients: Array<Client<Encrypted>> = [];
  const identities: Identity[] = [];

  beforeAll(async () => {
    const dbPath = await mktmp("end-to-end-test");
    server = new Server<Encrypted>(dbPath);

    for (let i = 0; i < numClients; i++) {
      identities.push(await EthCrypto.createIdentity());
      const client = new Client<Encrypted>("http://127.0.0.1:8000");
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
    const messages: { [index: string]: IMessage<Encrypted> } = {};

    // for clients 1..n, take the first message they receive and dump it into
    // the messages array
    for (let i = 1; i < numClients; i++) {
      clients[i].once("message", (message: IMessage<Encrypted>) => {
        messageCount++;
        messages[identities[i].address] = message;
      });
    }

    // have the 0th client send a unique message to clients 1..n
    for (let i = 1; i < numClients; i++) {
      const encryptedMessage = await EthCrypto.encryptWithPublicKey(
        identities[i].publicKey,
        `Hello there client 0x${identities[i].address}!`,
      );

      const message: IMessage<Encrypted> = {
        to: identities[i].address,
        message: encryptedMessage,
      };

      clients[0].sendMessage(message);
    }

    // add a short delay so the messages can fly around and do their thing
    await new Promise((resolve) => setTimeout(resolve, 150));

    assert.strictEqual(messageCount, numClients - 1);

    for (let i = 1; i < numClients; i++) {
      const decryptedMessage = await EthCrypto.decryptWithPrivateKey(
        identities[i].privateKey,
        messages[identities[i].address].message,
      );

      assert.strictEqual(decryptedMessage, `Hello there client 0x${identities[i].address}!`);
    }
  });

  afterAll(() => {
    for (let i = 0; i < numClients; i++) {
      clients[0].close();
    }

    server.close();
  });
});
