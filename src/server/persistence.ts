import fs from "fs";
import levelup, { LevelUp } from "levelup";
import encode from "encoding-down";
import leveldown from "leveldown";
import { IMessage } from "..";
import { v4 as uuid4 } from "uuid";
import { AbstractLevelDOWN } from "abstract-leveldown";

export interface IMessageWrapper<EncryptedMessageType> {
  id: string;
  receivedTime: number;
  deliveredTime: number | null;
  message: IMessage<EncryptedMessageType>;
  nextMessageId: string | "empty";
}

export class Persistence {
  private _db: LevelUp;

  constructor(dbPath: string, db: AbstractLevelDOWN | null = null) {

    // create the path to the data directory if it doesn't already exist
    try {
      fs.statSync(dbPath);
    } catch (err) {
      if (err.errno === -2 && err.code === "ENOENT") {
        fs.mkdirSync(dbPath, {
          recursive: true,
        });
      } else {
        throw err;
      }
    }

    if (!db) {
      db = leveldown(dbPath);
    }

    this._db = levelup(encode(db, { valueEncoding: "json" }));
  }

  public async persistMessage<EncryptedMessageType>(
    message: IMessage<EncryptedMessageType>,
    deliveredTime?: number | null,
  ) {
    const wrappedMessage = this._wrapMessage(message, deliveredTime);

    const recipient = wrappedMessage.message.to;

    // make sure we have a queue to write to we await this one to make sure that
    // there's always a valid tail entry
    await this._initializeQueue(wrappedMessage);

    // write our new message to the DB
    const messageWritePromise = this._db.put(wrappedMessage.id, wrappedMessage);

    // update the last message written to point to our new message, otherwise we
    // have a break in our linked list
    const lastMessageUpdatePromise = this._updateLastMessagePointer(wrappedMessage);

    // update the tail to point to our newly written message
    const tailUpdatePromise = this._db.put(`${recipient}|tail`, wrappedMessage.id);

    // wait for all of the above to complete - doing it this way is faster than
    // awaiting each promise individually as it takes better advantage of async
    // I/O
    await Promise.all([lastMessageUpdatePromise, messageWritePromise, tailUpdatePromise]);
  }

  public async *messages<EncryptedMessageType>(recipient: string, includeReadMessages = false) {
    let unreadHead = "empty";
    try {
      const headKey = includeReadMessages ? "head" : "unreadHead";
      unreadHead = await this._db.get(`${recipient}|${headKey}`);
    } catch (err) {
      if (err.notFound) {
        // just act the same way as if there are no unread messages
      } else {
        throw err;
      }
    }

    while (unreadHead.toString() !== "empty") {
      const wrappedMessage: IMessageWrapper<EncryptedMessageType> =
        await this._db.get(unreadHead) as IMessageWrapper<EncryptedMessageType>;
      const decodedMessage: IMessage<EncryptedMessageType> = wrappedMessage.message;

      yield decodedMessage;

      if (!wrappedMessage.deliveredTime) {
        wrappedMessage.deliveredTime = new Date().getTime();
        await this._db.put(wrappedMessage.id, wrappedMessage);
      }

      unreadHead = wrappedMessage.nextMessageId;

      if (!includeReadMessages) {
        await this._db.put(`${recipient}|unreadHead`, unreadHead);
      }
    }
  }

  private async _initializeQueue<EncryptedMessageType>(
    wrappedMessage: IMessageWrapper<EncryptedMessageType>,
  ): Promise<any> {
    const recipient = wrappedMessage.message.to;
    try {
      const head = await this._db.get(`${recipient}|head`);
    } catch (err) {
      if (err.notFound) {
        // rather than awaiting here we just return Promise.all(...) this lets
        // the I/O for this set of operations happen more concurrently than if
        // we await each operation independently
        const headPromise = this._db.put(`${recipient}|head`, wrappedMessage.id) as Promise<void>;
        const unreadHeadPromise = this._db.put(`${recipient}|unreadHead`, wrappedMessage.id) as Promise<void>;
        const tailPromise = this._db.put(`${recipient}|tail`, "empty") as Promise<void>;
        return Promise.all([headPromise, unreadHeadPromise, tailPromise]);
      } else {
        throw err;
      }
    }
  }

  private _wrapMessage<EncryptedMessageType>(
    message: IMessage<EncryptedMessageType>,
    deliveredTime?: number | null,
  ) {
    return {
      id: uuid4(),
      receivedTime: new Date().getTime(),
      deliveredTime: deliveredTime || null,
      message,
      nextMessageId: "empty",
    };
  }

  private async _updateLastMessagePointer<EncryptedMessageType>(message: IMessageWrapper<EncryptedMessageType>) {
    const lastMessageId = await this._db.get(`${message.message.to}|tail`);
    if (lastMessageId.toString() !== "empty") {
      const lastMessage = await this._db.get(lastMessageId) as IMessageWrapper<EncryptedMessageType>;
      lastMessage.nextMessageId = message.id;
      return this._db.put(lastMessageId, lastMessage);
    }
  }
}

export default Persistence;
