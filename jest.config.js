const path = require("path");
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: [path.resolve(__dirname, "test/", "**", "*.ts")]
};

