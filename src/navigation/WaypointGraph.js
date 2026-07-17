export class WaypointGraph {
  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
  }

  addNode(id, x, y, kind = 'road') {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, { id, x, y, kind });
      this.edges.set(id, new Set());
    }
    return this.nodes.get(id);
  }

  connect(fromId, toId) {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) return false;
    this.edges.get(fromId).add(toId);
    this.edges.get(toId).add(fromId);
    return true;
  }

  hasPath(fromId, toId) {
    return this.findPath(fromId, toId).length > 0;
  }

  findPath(fromId, toId) {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) return [];
    const queue = [fromId];
    const previous = new Map([[fromId, null]]);

    while (queue.length) {
      const current = queue.shift();
      if (current === toId) break;
      this.edges.get(current).forEach((next) => {
        if (previous.has(next)) return;
        previous.set(next, current);
        queue.push(next);
      });
    }

    if (!previous.has(toId)) return [];
    const path = [];
    for (let current = toId; current != null; current = previous.get(current)) {
      path.unshift(this.nodes.get(current));
    }
    return path;
  }

  getConnections() {
    const connections = [];
    this.edges.forEach((targets, fromId) => {
      targets.forEach((toId) => {
        if (fromId < toId) connections.push([this.nodes.get(fromId), this.nodes.get(toId)]);
      });
    });
    return connections;
  }
}
