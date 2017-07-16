import { Lifecycle, SystemMap, using } from "..";

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

  const createDatabase = (): Lifecycle => new Database();
  const createNewDatabase = (): Lifecycle => new NewDatabase();
  const createScheduler = (): Lifecycle => new Scheduler();
  const createExampleComponent = (): Lifecycle => new ExampleComponent();

  let order: Array<string>;
  let system: SystemMap;

  beforeEach(() => {
    order = [];
  });

  describe("lifecycle", () => {
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
    it("'should work with map", () => {
      system = new SystemMap({
        db: createDatabase(),
        sched: createScheduler(),
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
