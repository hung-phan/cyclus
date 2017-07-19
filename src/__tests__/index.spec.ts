import { Lifecycle, SystemMap, using } from "..";

describe("cyclus", () => {
  function timeout(ms: number): Promise<{}> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  class Database extends Lifecycle {
    public dbConnection: string;

    public start() {
      order.push("Start Database");
      this.dbConnection = "OPENED";
    }

    public stop() {
      order.push("Stop Database");
      this.dbConnection = "CLOSED";
    }
  }

  class Scheduler extends Lifecycle {
    public tick: number;

    public start() {
      order.push("Start Scheduler");
      this.tick = 10;
    }

    public stop() {
      order.push("Stop Scheduler");
    }
  }

  class ExampleComponent extends Lifecycle {
    private database: Database;
    private scheduler: Scheduler;

    public start() {
      order.push("Start ExampleComponent");
    }

    public stop() {
      order.push("Stop ExampleComponent");
    }
  }

  class NewDatabase extends Lifecycle {
    public dbConnection: string;

    public start() {
      order.push("Start NewDatabase");
      this.dbConnection = "OPENED";
    }

    public stop() {
      order.push("Stop NewDatabase");
      this.dbConnection = "CLOSED";
    }
  }

  const createDatabase = (): Lifecycle => new Database();
  const createNewDatabase = (): Lifecycle => new NewDatabase();
  const createScheduler = (): Lifecycle => new Scheduler();
  const createExampleComponent = (): Lifecycle => new ExampleComponent();

  let order: string[];
  let system: SystemMap;

  beforeEach(() => {
    order = [];
  });

  describe("lifecycle", () => {
    beforeEach(async () => {
      system = new SystemMap({
        database: createDatabase(),
        scheduler: createScheduler(),
        exampleComponent: using(createExampleComponent(), [
          "database",
          "scheduler"
        ])
      });
      await system.start();
    });

    it("should start the system in order", () => {
      expect(order).toMatchSnapshot();
    });

    it("should stop the system in reversed order", async () => {
      await system.stop();
      expect(order).toMatchSnapshot();
    });

    it("starting should be idempotent", async () => {
      await system.start();
      expect(order).toMatchSnapshot();
    });

    it("stopping should be idempotent", async () => {
      await system.stop();
      await system.stop();
      expect(order).toMatchSnapshot();
    });
  });

  describe("injecting dependencies correctly", () => {
    it("should work with map", async () => {
      system = new SystemMap({
        db: createDatabase(),
        sched: createScheduler(),
        exampleComponent: using(createExampleComponent(), {
          database: "db",
          scheduler: "sched"
        })
      });

      await system.start();

      expect(system).toMatchSnapshot();
    });
  });

  describe("replacing dependencies on the fly", () => {
    it("should replace but not start or stop any component", async () => {
      system = new SystemMap({
        database: createDatabase(),
        scheduler: createScheduler(),
        exampleComponent: using(createExampleComponent(), [
          "database",
          "scheduler"
        ])
      });

      expect(system).toMatchSnapshot();
      await system.replace({ database: createNewDatabase() });
      expect(system).toMatchSnapshot();

      expect(order).toMatchSnapshot();
    });

    it("should work for test use case", async () => {
      system = new SystemMap({
        database: createDatabase(),
        scheduler: createScheduler(),
        exampleComponent: using(createExampleComponent(), [
          "database",
          "scheduler"
        ])
      });

      await system.replace({ database: createNewDatabase() });
      await system.start();

      expect(order).toMatchSnapshot();
    });

    it("should restart correctly", async () => {
      system = new SystemMap({
        database: createDatabase(),
        scheduler: createScheduler(),
        exampleComponent: using(createExampleComponent(), [
          "database",
          "scheduler"
        ])
      });

      await system.start();

      expect(system).toMatchSnapshot();
      await system.replace({ database: createNewDatabase() }, { shouldRestart: true });
      expect(system).toMatchSnapshot();

      expect(order).toMatchSnapshot();
    });
  });

  describe("async", () => {
    class Component1 extends Lifecycle {
      public async start() {
        await timeout(100);
        order.push("Start component 1 after 1000");
      }

      public async stop() {
        await timeout(100);
        order.push("Stop component 1 after 1000");
      }
    }

    class Component2 extends Lifecycle {
      public async start() {
        await timeout(200);
        order.push("Start component 2 after 2000");
      }

      public async stop() {
        await timeout(200);
        order.push("Stop component 2 after 2000");
      }
    }

    class Component3 extends Lifecycle {
      private component1: Component1;
      private component2: Component2;

      public start() {
        order.push("Start component 3");
      }

      public stop() {
        order.push("Stop component 3");
      }
    }

    const createComponent1 = (): Lifecycle => new Component1();
    const createComponent2 = (): Lifecycle => new Component2();
    const createComponent3 = (): Lifecycle => new Component3();

    it("should wait for start or stop method to resolve", async () => {
      system = new SystemMap({
        component1: createComponent1(),
        component2: createComponent2(),
        component3: using(createComponent3(), ["component1", "component2"])
      });

      await system.start();

      expect(system).toMatchSnapshot();
      expect(order).toMatchSnapshot();
    });
  });

  describe("simple component", () => {
    class Component extends Lifecycle {
      private config: object;

      public start() {
        order.push("Start component 3");
      }

      public stop() {
        order.push("Stop component 3");
      }
    }
    const createComponent = (): Lifecycle => new Component();

    beforeEach(async () => {
      system = new SystemMap({
        config: {
          a: 1,
          b: 2
        },
        component: using(createComponent(), ["config"])
      });
      await system.start();
    });

    it("should work correctly", () => {
      expect(system).toMatchSnapshot();
    });

    it("should able to replace the config on the fly", async () => {
      await system.replace({
        config: { c: 3, d: 4 }
      });
      expect(system).toMatchSnapshot();
    });
  });
});
