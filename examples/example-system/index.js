const csp = require("js-csp");
const { SystemMap, LifeCycle, using } = require("cyclus");

function call(functionName, ...args) {
  console.log(`call ${functionName} with args: [${args.join(", ")}]`);
}

class Queue extends LifeCycle {
  constructor({ blockWhenFull }) {
    super();

    this.blockWhenFull = blockWhenFull;
  }

  start() {
    const self = this;

    this.stopChan = csp.chan(1);
    this.conn = call("connectToQueue", this.blockWhenFull);

    call("subscribeToQueue", function messageHandler(msg) {
      csp.putAsync(this.incomingMessagesChan, msg);
    });

    csp.go(function*() {
      while (true) {
        const { channel, value } = yield csp.alts([
          self.outgoingMessagesChan,
          self.stopChan
        ]);

        switch (channel) {
          case self.outgoingMessagesChan:
            call("publishToQueue", self.config, value);
            break;

          case self.stopChan:
            return;
        }
      }
    });
  }

  stop() {
    csp.putAsync(this.stopChan, "STOP", () => this.stopChan.close());
    call("closeConnection", this.conn);
  }
}

class Database extends LifeCycle {
  constructor(config) {
    super();

    this.config = config;
  }

  start() {
    this.conn = call("connectToDB", this.config);
  }

  stop() {
    call("closeDBConn", this.conn);
  }
}

class EmailService {
  constructor(config) {
    this.config = config;
  }

  send(msg, opts) {
    call("smtpSend", this.config, msg, opts);
  }
}

function logAndSendEmails(worker, emailMsg) {
  call("smtpSend", worker.emailService, emailMsg);
  call("writeStatusToDatabase", worker.db);

  return {
    emailMsg,
    status: "sent"
  };
}

class Worker extends LifeCycle {
  constructor({ workFn }) {
    super();

    this.workFn = workFn;
  }

  start() {
    const self = this;

    this.stopChan = csp.chan(1);

    csp.go(function*() {
      while (true) {
        const { channel, value } = yield csp.alts([
          self.inputChannel,
          self.stopChan
        ]);

        switch (channel) {
          case self.outgoingMessagesChan:
            csp.putAsync(self.resultChannel, self.workFn(self, value));
            break;

          case self.stopChan:
            return;
        }
      }
    });
  }

  stop() {
    csp.putAsync(this.stopChan, "STOP", () => this.stopChan.close());
  }
}

const system = (function(config) {
  return new SystemMap({
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
})({
  database: {
    host: "localhost",
    port: 1234,
    database: "db",
    user: "admin",
    password: "secret"
  },
  mailgun: {
    api: "SECRET API"
  },
  outgoingEmails: {
    blockWhenFull: false
  },
  sendEmails: {
    blockWhenFull: true
  }
});

system.start().then(() => {
  console.log("System started");
});
