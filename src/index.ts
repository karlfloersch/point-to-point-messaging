export { IMessage } from "./model/message";
export { Client } from "./client";
export { Server } from "./server/server";

import { Client } from "./client";
export default Client;

import runServer from "./server/server";
const isMainModule = () => require && require.main && require.main === module;
if (isMainModule()) {
  const server = runServer();
}
