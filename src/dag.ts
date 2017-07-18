import { PlainObject } from "./types";
import { CyclusError } from "./utils";

class Node {
  static INCOMING = "INCOMING";
  static OUTGOING = "OUTGOING";

  key: string;
  incomingNodes: Set<Node>;
  outgoingNodes: Set<Node>;

  constructor(key: string) {
    this.key = key;
    this.incomingNodes = new Set();
    this.outgoingNodes = new Set();
  }

  addNode(type: string, node: Node) {
    switch (type) {
      case Node.INCOMING:
        this.incomingNodes.add(node);
        break;

      case Node.OUTGOING:
        this.outgoingNodes.add(node);
        break;
    }
  }

  removeNode(type: string, node: Node) {
    switch (type) {
      case Node.INCOMING:
        this.incomingNodes.delete(node);
        break;

      case Node.OUTGOING:
        this.outgoingNodes.delete(node);
        break;
    }
  }
}

type Graph = { [key: string]: Node };

function getNodeWithoutParent(graph: Graph): Array<string> {
  return Object.keys(graph).filter(key => graph[key].incomingNodes.size === 0);
}

function buildTopoGraph(graph: Graph): Array<string> {
  const result = [];
  const nodeWithoutParent = getNodeWithoutParent(graph);

  while (nodeWithoutParent.length !== 0) {
    const node: Node = graph[nodeWithoutParent.pop()];

    result.push(node.key);

    node.outgoingNodes.forEach(connectedNode => {
      node.removeNode(Node.OUTGOING, connectedNode);
      connectedNode.removeNode(Node.INCOMING, node);

      if (connectedNode.incomingNodes.size === 0) {
        nodeWithoutParent.push(connectedNode.key);
      }
    });
  }

  if (result.length !== Object.keys(graph).length) {
    throw new CyclusError("Cycle detected", { graph });
  }

  return result;
}

export default function buildDAG(
  system: PlainObject,
  dependencyArray: Array<[string, string]>
): Array<string> {
  const graph: Graph = {};

  Object.keys(system).forEach(key => {
    graph[key] = new Node(key);
  });

  for (const [parent, child] of dependencyArray) {
    const parentNode = graph[parent];
    const childNode = graph[child];

    parentNode.addNode(Node.OUTGOING, childNode);
    childNode.addNode(Node.INCOMING, parentNode);
  }

  return buildTopoGraph(graph);
}
