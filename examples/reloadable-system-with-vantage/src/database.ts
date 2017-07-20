import { Lifecycle } from "cyclus";
import { Client } from "pg";

class Database extends Lifecycle {
  public client: Client;
  public readonly config: object;
  public counter: number;

  constructor(config) {
    super();

    this.config = config;
  }

  public async start() {
    this.counter = 0;
    this.client = new Client(this.config);
    await this.client.connect();

    console.log("Database started");
  }

  public async stop() {
    await this.client.end();

    console.log("Database stopped");
  }
}

export default Database;
