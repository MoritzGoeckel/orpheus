#!/usr/bin/env node
const readline = require("node:readline");

class OrpheusPlugin {
  constructor() {
    this.hooks = {};
    this.tools = {};
    this.nextId = 1;
    this.pending = new Map();
  }

  addHook(name, handler) {
    this.hooks[name] = handler;
    return this;
  }

  // parameters is a JSON Schema object: { type: "object", properties: {
  //   text: { type: "string", description: "Text to echo" }
  // }, required: ["text"], additionalProperties: false }.
  // properties names are argument names; required lists mandatory arguments.
  addTool(name, description, parameters, run) {
    this.tools[name] = { description, parameters, run };
    return this;
  }

  start() {
    const input = readline.createInterface({ input: process.stdin });
    input.on("line", (line) => this.receive(JSON.parse(line)));
  }

  async receive(request) {
    if (request.type === "return") {
      const pending = this.pending.get(request.id);
      if (!pending || pending.name !== request.name) throw new Error("unexpected plugin response");
      this.pending.delete(request.id);
      if (request.error) pending.reject(new Error(request.error.message));
      else pending.resolve(request.value);
      return;
    }
    if (request.type !== "invoke") throw new Error(`unexpected message type: ${request.type}`);
    if (request.name === "init") {
      this.respond(request, { hooks: Object.keys(this.hooks), tools: Object.entries(this.tools).map(([name, tool]) => ({ name, description: tool.description, parameters: tool.parameters })) });
      return;
    }
    if (request.name === "tool") {
      const tool = this.tools[request.params.name];
      try {
        this.respond(request, await tool.run(request.params.arguments, { callHost: this.callHost.bind(this) }));
      } catch (error) {
        this.respond(request, undefined, error);
      }
      return;
    }
    const hook = this.hooks[request.name];
    if (!hook) {
      this.respond(request, undefined, new Error(`unknown hook: ${request.name}`));
      return;
    }
    try {
      this.respond(request, await hook(request.params, { callHost: this.callHost.bind(this) }));
    } catch (error) {
      this.respond(request, undefined, error);
    }
  }

  callHost(name, params) {
    const id = this.nextId++;
    process.stdout.write(`${JSON.stringify({ type: "invoke", id, name, params })}\n`);
    return new Promise((resolve, reject) => this.pending.set(id, { name, resolve, reject }));
  }

  respond(request, value, error) {
    const response = { type: "return", id: request.id, name: request.name };
    if (error) response.error = { message: error.message || String(error) };
    else response.value = value === undefined ? null : value;
    process.stdout.write(`${JSON.stringify(response)}\n`);
  }
}

module.exports = { OrpheusPlugin };
