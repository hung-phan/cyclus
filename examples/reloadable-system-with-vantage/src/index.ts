import { SystemMap, using } from "cyclus";
import Database from "./database";
import WebApp from "./webapp";

function createSystem(config: { database: object }): SystemMap {
  return new SystemMap({
    database: new Database(config.database),
    webapp: using(new WebApp(), ["database"])
  });
}

module.exports = async () => {
  const config = {
    database: {
      user: "developer",
      database: "postgres",
      password: "developer"
    }
  };
  const system = createSystem(config);

  try {
    await system.start();
  } catch (e) {
    console.error(e);
  }

  if ((module as any).hot) {
    (module as any).hot.accept("./webapp", async () => {
      const NewWebApp = require("./webapp").default;

      try {
        await system.replace(
          { webapp: using(new NewWebApp(), ["database"]) },
          { shouldRestart: true }
        );
        console.log("WebApp updated");
      } catch (e) {
        console.error(e);
      }
    });

    (module as any).hot.accept("./database", async () => {
      const NewDatabase = require("./database").default;

      try {
        await system.replace(
          { database: new NewDatabase(config.database) },
          { shouldRestart: true }
        );
        console.log("Database updated");
      } catch (e) {
        console.error(e);
      }
    });
  }

  // expose system in debug mode
  (global as any).system = system;
};
