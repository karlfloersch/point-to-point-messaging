import assert from "assert";
import temp from "temp";
import pify from "pify";
import EthCrypto, { Encrypted } from "eth-crypto";

import { Persistence } from "../../src/server/persistence";
import { IMessage } from "../../src";
import { AssertionError } from "assert";

// tracks temp file creation and deletes on exit
temp.track();
const mktmp = pify(temp.mkdir);

// tslint:disable-next-line: interface-name
interface Identity {
  privateKey: string;
  publicKey: string;
  address: string;
}

describe("Persistence", () => {
  describe("Basic functionality", () => {
    let persistence: Persistence;
    let tempPath: string;
    let recipient: Identity;
    let encryptedMessage: Encrypted;

    beforeAll(async () => {
      tempPath = await mktmp("basic-functionality");
      persistence = new Persistence(tempPath);
      recipient = EthCrypto.createIdentity();
      encryptedMessage = await EthCrypto.encryptWithPublicKey(recipient.publicKey, "hello world");
    });

    test("should store message", async () => {
      await persistence.persistMessage({
        to: recipient.address,
        message: encryptedMessage,
      });

      // nothing to assert, passes if it doesn't throw
    });

    test("should retrieve stored message", async () => {
      const messages: Array<IMessage<Encrypted>> = [];

      for await (const message of persistence.messages<Encrypted>(recipient.address)) {
        messages.push(message);
      }

      assert.strictEqual(messages.length, 1, "Incorrect persisted message count!");
      const decryptedMessage = await EthCrypto.decryptWithPrivateKey(recipient.privateKey, messages[0].message);
      assert.strictEqual(decryptedMessage, "hello world");
    });
  });

  describe("Unread Messages Functionality", () => {
    let persistence: Persistence;
    let tempPath: string;
    let recipient: Identity;
    let encryptedMessage: Encrypted;

    beforeAll(async () => {
      tempPath = await mktmp("unread-messages-functionality");
      persistence = new Persistence(tempPath);
      recipient = EthCrypto.createIdentity();
      encryptedMessage = await EthCrypto.encryptWithPublicKey(recipient.publicKey, "hello world");

      await persistence.persistMessage({
        to: recipient.address,
        message: encryptedMessage,
      });
    });

    test("should only retrieve stored message once", async () => {
      const messages: Array<IMessage<Encrypted>> = [];

      for await (const message of persistence.messages<Encrypted>(recipient.address)) {
        messages.push(message);
      }

      assert.strictEqual(messages.length, 1, "Incorrect persisted message count!");

      // calling `messages` a second time without persisting a new message shouldn't get us any more messages
      for await (const message of persistence.messages<Encrypted>(recipient.address)) {
        messages.push(message);
      }

      assert.strictEqual(messages.length, 1, "Incorrect persisted message count!");
      const decryptedMessage = await EthCrypto.decryptWithPrivateKey(recipient.privateKey, messages[0].message);
      assert.strictEqual(decryptedMessage, "hello world");
    });

    test("should be capable of retrieving messages that have been read if flag is given", async () => {
      const messages: Array<IMessage<Encrypted>> = [];

      for await (const message of persistence.messages<Encrypted>(recipient.address, true)) {
        messages.push(message);
      }

      assert.strictEqual(messages.length, 1, "Incorrect persisted message count!");

      // calling `messages` a second time without persisting a new message shouldn't get us any more messages
      for await (const message of persistence.messages<Encrypted>(recipient.address, true)) {
        messages.push(message);
      }

      assert.strictEqual(messages.length, 2, "Incorrect persisted message count!");

      const decryptedMessage1 = await EthCrypto.decryptWithPrivateKey(recipient.privateKey, messages[0].message);
      assert.strictEqual(decryptedMessage1, "hello world");
      const decryptedMessage2 = await EthCrypto.decryptWithPrivateKey(recipient.privateKey, messages[1].message);
      assert.strictEqual(decryptedMessage2, "hello world");
    });
  });
});
