# Cyclus

[![build status](https://secure.travis-ci.org/hung-phan/cyclus.svg)](http://travis-ci.org/hung-phan/cyclus/)
[![codecov](https://codecov.io/gh/hung-phan/cyclus/branch/master/graph/badge.svg)](https://codecov.io/gh/hung-phan/cyclus)
[![dependencies Status](https://david-dm.org/hung-phan/cyclus/status.svg)](https://david-dm.org/hung-phan/cyclus)
[![devDependencies Status](https://david-dm.org/hung-phan/cyclus/dev-status.svg)](https://david-dm.org/hung-phan/cyclus?type=dev)

'Cyclus' is a tiny lib for managing the lifecycle and dependencies of software components which have runtime state.

Inspire from 'Component' in clojure, make sure you read the document [here](https://github.com/stuartsierra/component)

## Usage

```bash
npm install cyclus
```

```typescript
import { Lifecycle, SystemMap, using } from "cyclus";
// or import { Lifecycle, SystemMap, using } from "cyclus/dist/browser/cyclus";
// or import { Lifecycle, SystemMap, using } from "cyclus/dist/es5";
// or import { Lifecycle, SystemMap, using } from "cyclus/dist/es6";
// or import { Lifecycle, SystemMap, using } from "cyclus/dist/esnext";
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

### Simple system

SystemMap can access object that is not an instance of LifeCycle component. Make sure you see all examples [here](https://github.com/hung-phan/cyclus/tree/master/examples)

```typescript
const system = new SystemMap({
  inputChannel: csp.chan(1024),
  resultChannel: csp.chan(1024),
  db: new Database(config.database),
  mailgun: new EmailService(config.mailgun),
  worker: using(new Worker({ workFn: logAndSendEmails }), {
    inputChannel: "inputChannel",
    db: "db",
    emailService: "mailgun",
    resultChannel: "resultChannel"
  }),
  outgoingEmails: using(
    new Queue(
      Object.assign({}, config.outgoingEmails, {
        outgoingMessagesChan: csp.chan()
      })
    ),
    {
      incomingMessagesChan: "inputChannel"
    }
  ),
  sendEmails: using(
    new Queue(
      Object.assign({}, config.sendEmails, {
        incomingMessagesChan: csp.chan()
      })
    ),
    {
      outgoingMessagesChan: "resultChannel"
    }
  )
});
```

### Replace

Calling replace with given hashmap of new dependencies

#### Gracefully restart

```typescript
system.replace({ database: createNewDatabase() }, { shouldRestart: true });
```

This will automatically `stop` previous version of the database, and `start` a new one. Example for reloadable app
under example/reloadable-system

![alt text](https://raw.githubusercontent.com/hung-phan/cyclus/master/reloadable-system.gif "reloadable-system")

![alt text](https://raw.githubusercontent.com/hung-phan/cyclus/master/reloadable-with-vantage.gif "reloadable-system")

Additionally, `{ shouldRestart: [...someSystemKeys] }` will receive an array of components. This will stop those
components and start them again.

```typescript
system.replace({ database: createNewDatabase() }, { shouldRestart: ["scheduler"] });
```

In this case, it will stop both `database` and `scheduler` then start them again

#### Hot patch a running system

For many cases, gracefully restart won't work correctly due to the workload on each component. For example, we can't
stop a database in the middle of heavy load from client. So the best way is to create a new instance, replace a
running component, then stop old component

```typescript
const oldDatabaseComponent = system.map.database;
const newDatabaseComponent = createNewDatabase();

await newDatabaseComponent.start();
await system.replace({ database: newDatabaseComponent });
await oldDatabaseComponent.stop(); // this has to process any remained request before exist
```

#### Testing

```typescript
system.replace({ database: createFakeDatabase() })
system.start();
```

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
