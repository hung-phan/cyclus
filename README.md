# Cyclus

'Cyclus' is a tiny lib for managing the lifecycle and dependencies of software components which have runtime state.

Inspire from 'Component' in clojure, make sure you read the document [here](https://github.com/stuartsierra/component)

## Usage

```bash
npm install cyclus
```

```typescript
import { Lifecycle, SystemMap, using } from "cyclus";
```

### Creating Components

To create a component, define a class that extends `Lifecycle` class.

```typescript
class Database extends Lifecycle {
  dbConnection: string;

  start() {
    console.log("Start Database");
    this.dbConnection = "OPENED";
  }

  stop() {
    console.log("Stop Database");
    this.dbConnection = "CLOSED";
  }
}
  
class Scheduler extends Lifecycle {
  tick: number;

  start() {
    console.log("Start Scheduler");
    this.tick = 10;
  }

  stop() {
    console.log("Stop Scheduler");
  }
}
```

Optionally, provide a constructor function that takes arguments for
the essential configuration parameters of the component, leaving the
runtime state blank.

```clojure
const createDatabase = (): Lifecycle => new Database();
```

Define other components in terms of the components on which they
depend.

```typescript
class ExampleComponent extends Lifecycle {
  database: Database;
  scheduler: Scheduler;

  start() {
    console.log("Start ExampleComponent");
  }

  stop() {
    console.log("Stop ExampleComponent");
  }
}
```

**Do not pass component dependencies in a constructor.**
Systems are responsible for injecting runtime dependencies into the
components they contain: see the next section.


### Systems

Components are composed into systems. A system is a component which
knows how to start and stop other components. It is also responsible
for injecting dependencies into the components which need them.

Specify the dependency relationships among components with the `using`
function. `using` takes a component and a collection of keys naming
that component's dependencies.

If the component and the system use the same keys, then you can
specify dependencies as a array of keys:

```typescript
const system = new SystemMap({
  database: createDatabase(),
  scheduler: createScheduler(),
  exampleComponent: using(createExampleComponent(), [
    "database",
    "scheduler"
  ])
});
```

If the component and the system use *different* keys, then specify
them as a map of `{ [component-key]: "system-key" }`.
That is, the `using` keys match the keys in the component,
the values match keys in the system.

```typescript
const system = new SystemMap({
  db: createDatabase(),
  sched: createScheduler(),
  exampleComponent: using(createExampleComponent(), {
    database: "db",
    scheduler: "sched"
  })
});
//  ^          ^
//  |          |
//  |          \- Keys in the system map
//  |
//  \- Keys in the ExampleComponent record
```

The system map provides its own implementation of the Lifecycle
protocol which uses this dependency information (stored as metadata on
each component) to start the components in the correct order.

Before starting each component, the system will `assign` its
dependencies based on the metadata provided by `using`.

Stop a system by calling the `stop` method on it. This will stop each
component, in *reverse* dependency order, and then re-assign the
dependencies of each component. **Note:** `stop` is not the exact
inverse of `start`; component dependencies will still be associated.

```typescript
system.start();
```

### Replace

To patch a running system, call replace on the system with given
hashmap of new dependencies.

```typescript
system.replace({ database: createNewDatabase() });
```

This will automatically `stop` previous version of the database, and `start` a new one.

### Promise

`start`, `stop`, or `replace` will return a promise instead of running synchronously. So makes sure you wait for the
promise to resolve.

```typescript
const order = [];

class Component1 extends Lifecycle {
  async start() {
    await timeout(1000);
    order.push("Start component 1 after 1000");
  }

  async stop() {
    await timeout(1000);
    order.push("Stop component 1 after 1000");
  }
}

class Component2 extends Lifecycle {
  async start() {
    await timeout(2000);
    order.push("Start component 2 after 2000");
  }

  async stop() {
    await timeout(2000);
    order.push("Stop component 2 after 2000");
  }
}

class Component3 extends Lifecycle {
  component1: Component1;
  component2: Component2;

  start() {
    order.push("Start component 3");
  }

  stop() {
    order.push("Stop component 3");
  }
}

const system = new SystemMap({
  component1: createComponent1(),
  component2: createComponent2(),
  component3: using(createComponent3(), ["component1", "component2"])
});

system.start().then(() => {
  // system started
  // order = [
  //   "Start component 2 after 2000",
  //   "Start component 1 after 1000",
  //   "Start component 3"
  // ];
});
```
 
### Idempotent

A system is idempotent, this means it doesn't how many time your trigger a system to `start` or `stop`,
it will behave as if you was calling it once. For example,

```typescript
system.start();
system.start();  // => system.start();
system.start();
```

### Raw access to component

After component initialized, it will create a map at `.map` from `system`, this is intended for internal access only.
This can be use to access component after they are started or stopped, but do not *modify* system.map directly, use
`replace` instead.

```typescript
const system = new SystemMap({
  component1: createComponent1(),
  component2: createComponent2(),
  component3: using(createComponent3(), ["component1", "component2"])
});

system.start().then(() => {
  // system started

  console.log(system.map); // => { component1, component2, component3 }
});
```
