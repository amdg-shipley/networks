// BFS pathfinding — shared by Level 4 (simulated) and Level 6 (Firebase topology)
// All functions are pure: no DOM or Firebase dependencies.

/**
 * BFS shortest path between two nodes.
 *
 * @param {Map<string, {alive: boolean}>} nodes  - node id → node state
 * @param {Array<{from:string, to:string}>} edges
 * @param {string} sourceId
 * @param {string} targetId
 * @returns {string[] | null}  Array of nodeIds (inclusive), or null if unreachable
 */
export function bfs(nodes, edges, sourceId, targetId) {
  if (sourceId === targetId) return [sourceId];

  // Build adjacency list from live nodes only
  const adj = buildAdj(nodes, edges);

  const visited = new Set([sourceId]);
  const queue   = [[sourceId]];

  while (queue.length) {
    const path = queue.shift();
    const node = path[path.length - 1];

    for (const neighbor of (adj.get(node) || [])) {
      if (neighbor === targetId) return [...path, neighbor];
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }
  return null;
}

/**
 * Find all single points of failure (nodes whose removal disconnects the graph).
 *
 * @param {Map<string, {alive: boolean}>} nodes
 * @param {Array<{from:string, to:string}>} edges
 * @returns {string[]}  nodeIds that are SPOFs
 */
export function findSinglePointsOfFailure(nodes, edges) {
  const liveIds = Array.from(nodes.entries())
    .filter(([, n]) => n.alive !== false)
    .map(([id]) => id);

  if (liveIds.length < 2) return [];

  const spofs = [];

  for (const candidate of liveIds) {
    // Temporarily remove candidate
    const subNodes = new Map(nodes);
    subNodes.set(candidate, { ...(nodes.get(candidate) || {}), alive: false });

    const remaining = liveIds.filter(id => id !== candidate);
    if (remaining.length === 0) continue;

    const start = remaining[0];
    const adj   = buildAdj(subNodes, edges);

    const visited = new Set([start]);
    const queue   = [start];
    while (queue.length) {
      const cur = queue.shift();
      for (const nb of (adj.get(cur) || [])) {
        if (!visited.has(nb)) { visited.add(nb); queue.push(nb); }
      }
    }

    if (visited.size < remaining.length) spofs.push(candidate);
  }

  return spofs;
}

/**
 * Check whether every live node can reach every other live node via 2+ independent paths.
 * Uses a simplified check: the graph remains connected after removing any single edge.
 *
 * @param {Map<string, {alive: boolean}>} nodes
 * @param {Array<{from:string, to:string}>} edges
 * @returns {boolean}
 */
export function isFaultTolerant(nodes, edges) {
  // A graph is 2-edge-connected if every edge removal leaves it connected.
  // For the classroom definition, we use the simpler node-redundancy check:
  // every node has at least 2 paths to every other node ≡ no bridges exist.
  const liveIds = Array.from(nodes.entries())
    .filter(([, n]) => n.alive !== false)
    .map(([id]) => id);

  if (liveIds.length < 3) return false;

  // Check: no bridges (edges whose removal disconnects the graph)
  const liveEdges = edges.filter(e =>
    (nodes.get(e.from)?.alive !== false) &&
    (nodes.get(e.to)?.alive   !== false)
  );

  for (let i = 0; i < liveEdges.length; i++) {
    const subset = liveEdges.filter((_, j) => j !== i);
    if (!isConnected(nodes, subset, liveIds)) return false;
  }

  return liveIds.length > 0;
}

// ── Internal helpers ──────────────────────────────────────

function buildAdj(nodes, edges) {
  const adj = new Map();

  for (const [id, node] of nodes) {
    if (node.alive !== false) adj.set(id, []);
  }

  for (const edge of edges) {
    const fromAlive = nodes.get(edge.from)?.alive !== false;
    const toAlive   = nodes.get(edge.to)?.alive   !== false;
    if (!fromAlive || !toAlive) continue;

    if (!adj.has(edge.from)) adj.set(edge.from, []);
    if (!adj.has(edge.to))   adj.set(edge.to, []);

    adj.get(edge.from).push(edge.to);
    adj.get(edge.to).push(edge.from);
  }
  return adj;
}

function isConnected(nodes, edges, liveIds) {
  if (liveIds.length === 0) return true;
  const adj     = buildAdj(nodes, edges);
  const visited = new Set([liveIds[0]]);
  const queue   = [liveIds[0]];
  while (queue.length) {
    const cur = queue.shift();
    for (const nb of (adj.get(cur) || [])) {
      if (!visited.has(nb)) { visited.add(nb); queue.push(nb); }
    }
  }
  return visited.size === liveIds.length;
}
