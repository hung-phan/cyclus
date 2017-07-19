## Mocking system in test

Using cyclus allows us to stub out any components when testing. For example, let assume we have the following
system in place

```typescript
// main.js
import { Client } from "pg";
import { Lifecycle, SystemMap, using } from "cyclus";

class Database extends Lifecycle {
  client: Client;
  
  async start() {
    this.client = new Client();
    await this.client.connect();
  }
  
  async stop() {
    await this.client.end();
  }
}

class WebApp extends Lifecycle {
  database: Database;
  
  async start() {
    console.log("Start webapp server");
    
    const res = await this.database.client.query('SELECT $1::text as message', ['Hello world!']);
    
    console.log("Result", res.rows[0].message);
  }
  
  stop() {
    console.log("Stop webapp server");
  }
}

export const system = new SystemMap({
  database: new Database(),
  webapp: using(new WebApp(), ["database"])
});

// test-main.js
import { system } from "./main";

describe("main.js", () => {
  const mock = jest.fn();
  
  class FakeDatabase extends Lifecycle {
    client: {
      query(queryString: string, args: Array<any>);
    };
    
    constructor() {
      super();
      
      this.client = {
        query(queryString: string, args: Array<any>) {
          mock(queryString, args);
        }
      }
    }
  
    async start() {
      console.log("Fake db started");
    }
  
    async stop() {
      console.log("Fake db stopped");
    }
  }
  
  it("should log 'Result Hello from the other side'", async () => {
    mock.mockReturnValue({
      rows: [{ message: "Hello from the other side" }]
    });
    
    await system.replace({ database: new FakeDatabase() });
    await system.start();
    
    // => This will call `WebApp.start` with fake client from FakeDatabase, which resolves
    // Result Hello from the other side
  });
});
```