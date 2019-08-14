import assert from "assert";
import temp from "temp";
import pify from "pify";

import { Persistence } from "../../src/server/persistence";
import { IMessage } from "../../src";
import { AssertionError } from "assert";

// tracks temp file creation and deletes on exit
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

describe("Persistence", () => {
  describe("Basic functionality", () => {
    let persistence: Persistence;
    let tempPath: string;
    let recipient: Identity;
    let fakeEncryptedMessage: FakeEncryptedMessage;

    beforeAll(async () => {
      tempPath = await mktmp("basic-functionality");
      persistence = new Persistence(tempPath);
      recipient = {
        address: "0x0000000000000000000000000000000000000001",
      }
      fakeEncryptedMessage = {
        plaintext: "hello world",
      };
    });

    test("should store message", async () => {
      await persistence.persistMessage({
        to: recipient.address,
        message: fakeEncryptedMessage,
      });

      // nothing to assert, passes if it doesn't throw
    });

    test("should retrieve stored message", async () => {
      const messages: Array<IMessage<FakeEncryptedMessage>> = [];

      for await (const message of persistence.messages<FakeEncryptedMessage>(recipient.address)) {
        messages.push(message);
      }

      assert.strictEqual(messages.length, 1, "Incorrect persisted message count!");
      const fakeDecryptedMessage = messages[0].message.plaintext;
      assert.strictEqual(fakeDecryptedMessage, "hello world");
    });
  });

  describe("Unread Messages Functionality", () => {
    let persistence: Persistence;
    let tempPath: string;
    let recipient: Identity;
    let fakeEncryptedMessage: FakeEncryptedMessage;

    beforeAll(async () => {
      tempPath = await mktmp("unread-messages-functionality");
      persistence = new Persistence(tempPath);
      recipient = {
        address: "0x0000000000000000000000000000000000000001",
      }
      fakeEncryptedMessage = {
        plaintext: "hello world",
      };

      await persistence.persistMessage({
        to: recipient.address,
        message: fakeEncryptedMessage,
      });
    });

    test("should only retrieve stored message once", async () => {
      const messages: Array<IMessage<FakeEncryptedMessage>> = [];

      for await (const message of persistence.messages<FakeEncryptedMessage>(recipient.address)) {
        messages.push(message);
      }

      assert.strictEqual(messages.length, 1, "Incorrect persisted message count!");

      // calling `messages` a second time without persisting a new message shouldn't get us any more messages
      for await (const message of persistence.messages<FakeEncryptedMessage>(recipient.address)) {
        messages.push(message);
      }

      assert.strictEqual(messages.length, 1, "Incorrect persisted message count!");
      const fakeDecryptedMessage = await messages[0].message.plaintext;
      assert.strictEqual(fakeDecryptedMessage, "hello world");
    });

    test("should be capable of retrieving messages that have been read if flag is given", async () => {
      const messages: Array<IMessage<FakeEncryptedMessage>> = [];

      for await (const message of persistence.messages<FakeEncryptedMessage>(recipient.address, true)) {
        messages.push(message);
      }

      assert.strictEqual(messages.length, 1, "Incorrect persisted message count!");

      // calling `messages` a second time without persisting a new message shouldn't get us any more messages
      for await (const message of persistence.messages<FakeEncryptedMessage>(recipient.address, true)) {
        messages.push(message);
      }

      assert.strictEqual(messages.length, 2, "Incorrect persisted message count!");

      const fakeDecryptedMessage1 = messages[0].message.plaintext;
      assert.strictEqual(fakeDecryptedMessage1, "hello world");
      const fakeDecryptedMessage2 = messages[1].message.plaintext;
      assert.strictEqual(fakeDecryptedMessage2, "hello world");
    });
  });
});
