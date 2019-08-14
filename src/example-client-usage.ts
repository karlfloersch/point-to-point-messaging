import { Client } from "./client";

// tslint:disable-next-line: interface-name
interface FakeEncryptedMessage {
  plaintext: string;
}

class FriendlyUser {
  public client: Client<FakeEncryptedMessage>;
  public myAddress: string;
  public friendAddress: string;

  constructor(myAddress: string, friendAddress: string, url= "http://127.0.0.1:8000") {
    this.client = new Client<FakeEncryptedMessage>(url);
    this.myAddress = myAddress;
    this.friendAddress = friendAddress;
    // Subscribe to our myAddress's messages
    this.client.subscribe(this.myAddress);
    // Register an on new message event handler
    this.client.on("message", (message) => {
      // tslint:disable-next-line
      console.log(this.myAddress, "received message:", message);
    });
  }

  public sendFriendMessage(message: FakeEncryptedMessage) {
    this.client.sendMessage({
      to: this.friendAddress,
      message,
    });
  }

  public startChatting() {
    // tslint:disable-next-line
    console.log("In startChatting");
    setTimeout(() => {
      this.sendFriendMessage({ plaintext: "Hello friend!" });
      this.startChatting();
    }, Math.random() * 1000);
  }
}

const aliceAddress = "0x1234";
const bobAddress = "0x9876";

const alice = new FriendlyUser(aliceAddress, bobAddress);
const bob = new FriendlyUser(bobAddress, aliceAddress);

alice.startChatting();
bob.startChatting();

const numUsers = 500;
const users = [];
for (let i = 0; i < numUsers; i++) {
  users.push(new FriendlyUser(`${i}`, `${i + 1}`));
  users[i].startChatting();
}
// Let's see how this goes!
