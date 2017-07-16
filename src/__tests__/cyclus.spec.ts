import { Lifecycle, SystemMap, using } from "../cyclus";

describe("cyclus", () => {
  class Database extends Lifecycle {
    dbConnection: string;

    start() {
      order.push("Start Database");
      this.dbConnection = "OPENED";
    }

    stop() {
      order.push("Stop Database");
      this.dbConnection = "CLOSED";
    }
  }

  class Scheduler extends Lifecycle {
    tick: number;

    start() {
      order.push("Start Scheduler");
      this.tick = 10;
    }

    stop() {
      order.push("Stop Scheduler");
    }
  }
  const createDatabase = (): Lifecycle => new Database();
  const createScheduler = (): Lifecycle => new Scheduler();
  let order: Array<string>;
  let system: SystemMap;

  beforeEach(() => {
    order = [];
  });

  describe("lifecycle", () => {
    class ExampleComponent extends Lifecycle {
      database: Database;
      scheduler: Scheduler;

      start() {
        order.push("Start ExampleComponent");
      }

      stop() {
        order.push("Stop ExampleComponent");
      }
    }
    const createExampleComponent = (): Lifecycle => new ExampleComponent();

    beforeEach(() => {
      system = new SystemMap({
        database: createDatabase(),
        scheduler: createScheduler(),
        exampleComponent: using(createExampleComponent(), [
          "database",
          "scheduler"
        ])
      });
      system.start();
    });

    it("should start the system in order", () => {
      expect(order).toMatchSnapshot();
    });

    it("should stop the system in reversed order", () => {
      system.stop();
      expect(order).toMatchSnapshot();
    });

    it("starting should be idempotent", () => {
      system.start();
      expect(order).toMatchSnapshot();
    });

    it("stopping should be idempotent", () => {
      system.stop();
      system.stop();
      expect(order).toMatchSnapshot();
    });
  });

  describe("injecting dependencies correctly", () => {
    class ExampleComponent extends Lifecycle {
      db: Database;
      sched: Scheduler;

      start() {
        order.push("Start ExampleComponent");
      }

      stop() {
        order.push("Stop ExampleComponent");
      }
    }
    const createExampleComponent = (): Lifecycle => new ExampleComponent();

    it("'should work with map", () => {
      system = new SystemMap({
        database: createDatabase(),
        scheduler: createScheduler(),
        exampleComponent: using(createExampleComponent(), {
          database: "db",
          scheduler: "sched"
        })
      });

      system.start();

      expect(system).toMatchSnapshot();
    });
  });

  describe("replacing dependencies on the fly", () => {
    class NewDatabase extends Lifecycle {
      dbConnection: string;

      start() {
        order.push("Start NewDatabase");
        this.dbConnection = "OPENED";
      }

      stop() {
        order.push("Stop NewDatabase");
        this.dbConnection = "CLOSED";
      }
    }

    class ExampleComponent extends Lifecycle {
      database: Database | NewDatabase;
      scheduler: Scheduler;

      start() {
        order.push("Start ExampleComponent");
      }

      stop() {
        order.push("Stop ExampleComponent");
      }
    }
    const createNewDatabase = (): Lifecycle => new NewDatabase();
    const createExampleComponent = (): Lifecycle => new ExampleComponent();

    it("'should work correctly", () => {
      system = new SystemMap({
        database: createDatabase(),
        scheduler: createScheduler(),
        exampleComponent: using(createExampleComponent(), [
          "database",
          "scheduler"
        ])
      });

      system.start();

      expect(system).toMatchSnapshot();
      system.replace({ database: createNewDatabase() });
      expect(system).toMatchSnapshot();

      expect(order).toMatchSnapshot();
    });
  });
});
