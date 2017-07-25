import { CyclusError } from "./utils";

class Node {
  public static INCOMING = "INCOMING";
  public static OUTGOING = "OUTGOING";

  public readonly key: string;
  public readonly incomingNodes: Set<Node>;
  public readonly outgoingNodes: Set<Node>;

  constructor(key: string) {
    this.key = key;
    this.incomingNodes = new Set();
    this.outgoingNodes = new Set();
  }

  public addNode(type: string, node: Node) {
    switch (type) {
      case Node.INCOMING:
        this.incomingNodes.add(node);
        break;

      case Node.OUTGOING:
        this.outgoingNodes.add(node);
        break;
    }
  }

  public removeNode(type: string, node: Node) {
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

interface IGraph {
  [key: string]: Node;
}

function getNodeWithoutParent(graph: IGraph): string[] {
  return Object.keys(graph).filter(key => graph[key].incomingNodes.size === 0);
}

function buildTopoGraph(graph: IGraph): string[] {
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
  systemMap: object,
  dependencyArray: Array<[string, string]>
): string[] {
  const graph: IGraph = {};

  for (const key of Object.keys(systemMap)) {
    graph[key] = new Node(key);
  }

  for (const [parent, child] of dependencyArray) {
    const parentNode = graph[parent];
    const childNode = graph[child];

    parentNode.addNode(Node.OUTGOING, childNode);
    childNode.addNode(Node.INCOMING, parentNode);
  }

  return buildTopoGraph(graph);
}
