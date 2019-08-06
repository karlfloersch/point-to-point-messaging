import io from "socket.io-client";
import { IMessage } from ".";
import EventEmitter from "events";

export class Client<EncryptedMessageType> extends EventEmitter {
  public get url() {
    return this._url;
  }

  public get subscriptions() {
    return this._subscriptions;
  }

  private _url: string;
  private _socket: SocketIOClient.Socket;
  private _subscriptions: string[];

  constructor(url: string) {
    super();
    const self = this;
    this._url = url;
    this._socket = io(url);
    this._subscriptions = [];
    this._socket.on("connect", () => {
      self.emit("connected");
      self._socket.on("message", (message: IMessage<EncryptedMessageType>) => self.emit("message", message));
      self._socket.on("disconnect", (reason: string) => self.emit("disconnected", reason));

      // handles subscriptions entered before connection complete
      // also handles resubscribing on reconnect
      self._resubscribe();
    });

    this._socket.on("disconnect", (reason: string) => {
      self.emit("disconnected", reason);
    });

    this._socket.on("connect_error", (error: Error) => {
      self.emit("connect_error", error);
    });

    this._socket.on("connect_timeout", (timeout: any) => {
      self.emit("connect_timeout", timeout);
    });
  }

  public subscribe(address: string) {
    this._subscriptions.push(address);
    if (this._socket.connected) {
      this._socket.emit("subscribe", address);
    }
  }

  public sendMessage(message: IMessage<EncryptedMessageType>) {
    this._socket.send(message);
  }

  public close() {
    this._socket.close();
  }

  private _resubscribe() {
    for (const address of this._subscriptions) {
      this._socket.emit("subscribe", address);
    }
  }
}

export default Client;
