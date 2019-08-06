import * as yargs from "yargs";
import { booleanLiteral } from "@babel/types";
import path from "path";
import os from "os";

const homedir = os.homedir();

export default function getArgs() {
  return yargs
    .strict()
    .option("port", {
      alias: "p",
      default: 8000,
      describe: "External port on which to listen",
      type: "number",
    })
    .option("dbPath", {
      alias: "d",
      default: path.join(homedir, ".config", "point-to-point-messaging", "database"),
      describe: "Path which should be used for storing the LevelDB database",
      type: "string",
    })
    .option("hostname", {
      alias: "i",
      default: "127.0.0.1",
      describe: "External ip address on which to listen",
      type: "string",
    }).option("logLevel", {
      alias: "l",
      choices: ["debug", "info", "warning", "error"],
      default: "info",
      describe: "Sets the verbosity of the logging output",
    }).option("jsonLogs", {
      alias: "j",
      describe: "If specified, makes log lines write out in JSON format",
      type: "boolean",
    })
    .help()
    .alias("help", "h")
    .showHelpOnFail(true)
    .parse();
}
