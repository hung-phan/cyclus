import { Lifecycle } from "cyclus";
import * as express from "express";
import { Server } from "http";
import * as enableDestroy from "server-destroy";
import Database from "./database";

class WebApp extends Lifecycle {
  private app: express.Application;
  private database: Database;
  private server: Server;

  public async start() {
    this.app = express();

    this.app.get("/", async (req: express.Request, res: express.Response) => {
      const result = await this.database.client.query("SELECT 1");

      res.send(`
        <div>Counter: ${++this.database.counter}</div>
        <div>Message from db: ${JSON.stringify(result)}</div>
      `);
    });

    this.server = await this.app.listen(3000);
    console.log("Server started on port 3000");

    enableDestroy(this.server);
  }

  public async stop() {
    console.log("Stopping webapp");
    await (this.server as any).destroy();
    console.log("Server stopped");
  }
}

export default WebApp;
