import winston from "winston";
import getArgs from "./args";

import * as http from "http";
import express from "express";
import socketio from "socket.io";

import { IMessage } from "..";
import Persistence from "./persistence";

export class Server<EncryptedMessageType> {
  public get hostname() {
    return this._hostname;
  }

  get port() {
    return this._port;
  }

  private _hostname: string;
  private _port: number;
  private _logger: winston.Logger;
  private _server: http.Server;
  private _app: express.Express;
  private _io: socketio.Server;
  private _db: Persistence;

  private _subscriptionsBySocket: Map<socketio.Socket, string[]> = new Map<socketio.Socket, string[]>();
  private _subscriptionsByRecipient: Map<string, socketio.Socket[]> = new Map<string, socketio.Socket[]>();

  constructor(dbPath: string, hostname?: string, port?: number, logger?: winston.Logger) {
    const self = this;

    this._hostname = hostname || "127.0.0.1";
    this._port = port || 8000;

    if (!logger) {
      const defaultLogFormat = _getLogFormat({ jsonLogs: false });

      this._logger = winston.createLogger({
        level: "info",
        transports: [
          new winston.transports.Console({ format: defaultLogFormat }),
        ],
      });
    } else {
      this._logger = logger;
    }

    this._app = express();
    this._app.set("port", this._port);

    this._app.get("/", (req: express.Request, res: express.Response) => {
      res.status(404);
    });

    this._db = new Persistence(dbPath);

    this._server = new http.Server(this._app);
    this._io = socketio(this._server);
    this._server.listen(this._port, this._hostname, () => {
      self._logger.info(`Server listening on ${self._hostname}:${self.port}`);
    });

    this._io.on("connection", (socket: socketio.Socket) => {
      this._logger.info("client connected", { remoteHost: socket.handshake.address });
      socket.on("subscribe", (recipient: string) => self._handleSubscription(socket, recipient));
      socket.on("message", (message: IMessage<EncryptedMessageType>) => self._handleMessage(socket, message));
      socket.on("disconnect", (_) => self._handleDisconnect(socket));
    });
  }

  public close() {
    this._io.close();
    this._server.close();
  }

  private async _handleSubscription(socket: socketio.Socket, recipient: string) {
    if (!this._subscriptionsByRecipient.has(recipient.toLowerCase())) {
      this._subscriptionsByRecipient.set(recipient.toLowerCase(), []);
    }

    if (!this._subscriptionsBySocket.has(socket)) {
      this._subscriptionsBySocket.set(socket, []);
    }

    const sockets = this._subscriptionsByRecipient.get(recipient.toLowerCase()) as socketio.Socket[];
    const recipients = this._subscriptionsBySocket.get(socket) as string[];

    if (!sockets.includes(socket)) {
      sockets.push(socket);
    }

    if (!recipients.includes(recipient)) {
      recipients.push(recipient.toLowerCase());
    }

    this._logger.info("new subscription", { remoteHost: socket.handshake.address, address: recipient });
    await this._dumpMessages(recipient);
  }

  private _handleMessage(socket: socketio.Socket, message: IMessage<EncryptedMessageType>) {
    const recipient = message.to.toLowerCase();
    const recipientSockets = this._subscriptionsByRecipient.get(recipient) as socketio.Socket[] || [];
    const deliveredTime = recipientSockets.length > 0 ? new Date().getTime() : null;

    for (const recipientSocket of recipientSockets) {
      this._logger.info("delivering message", {
        message,
        deliveredToHost: recipientSocket.handshake.address,
        receivedFromHost: socket.handshake.address,
      });
      recipientSocket.send(message);
    }

    if (!deliveredTime) {
      this._logger.info("received message but no recipient connected", {
        message,
        receivedFromHost: socket.handshake.address,
      });
    }

    this._db.persistMessage(message, deliveredTime);
  }

  private async _dumpMessages(recipient: string, includeReadMessages = false) {
    const recipientSockets = this._subscriptionsByRecipient.get(recipient) as socketio.Socket[] || [];
    for await (const message of this._db.messages(recipient, includeReadMessages)) {
      for (const recipientSocket of recipientSockets) {
        this._logger.info("delivering persisted message", {
          message,
          deliveredToHost: recipientSocket.handshake.address,
        });

        recipientSocket.send(message);
      }
    }
  }

  private _handleDisconnect(socket: socketio.Socket): void {
    // client must handle reconnect event and resubscribe
    this._logger.info("client disconnected", { remoteHost: socket.handshake.address });
    const recipients = this._subscriptionsBySocket.get(socket) as string[] || [];
    for (const recipient of recipients) {
        this._subscriptionsByRecipient.delete(recipient);
    }

    if (recipients.length > 0) {
      this._subscriptionsBySocket.delete(socket);
    }
  }
}

export default function runServer<EncryptedMessageType>(): Server<EncryptedMessageType> {
  const args = getArgs();
  const format = _getLogFormat({ jsonLogs: args.jsonLogs });
  const logger = winston.createLogger({
    level: args.logLevel,
    transports: [
      new winston.transports.Console({ format }),
    ],
  });

  const server = new Server<EncryptedMessageType>(args.dbPath, args.hostname, args.port, logger);

  return server;
}

function _getLogFormat(args: { jsonLogs?: boolean }) {
  if (args.jsonLogs) {
    return winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
    );
  } else {
    return winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp(),
      winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`),
    );
  }
}
