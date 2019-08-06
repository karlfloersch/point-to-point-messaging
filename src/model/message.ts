export interface IMessage<EncryptedMessageType> {
  to: string;
  message: EncryptedMessageType;
}

export default IMessage;
