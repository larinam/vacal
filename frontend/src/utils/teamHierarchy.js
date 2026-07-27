/**
 * Team-hierarchy helpers built on the `parent_team_id` field that each team
 * carries (a reference to another team's `_id`).
 *
 * Every helper is pure and defensive about the stored data: an unknown or
 * self-referencing parent roots the team, and cycles can never make a helper
 * hang or drop a team.
 */

/**
 * @typedef {Object} TeamTreeNode
 * @property {Object} team - the original team object, by reference.
 * @property {number} depth - nesting level, 0 for roots.
 * @property {string|null} parentId - resolved parent id, null for roots.
 * @property {boolean} hasChildren - whether the team has any sub-team.
 */

const byName = (a, b) => (a.name || '').localeCompare(b.name || '');

/**
 * Flatten a team array into depth-first, depth-annotated render order with
 * siblings sorted by name.
 *
 * Guarantees that every input team appears exactly once in the output,
 * whatever the stored `parent_team_id` values look like.
 *
 * @param {Array<{_id: string, name?: string, parent_team_id?: string}>} teams
 * @returns {TeamTreeNode[]}
 */
export const flattenTeamTree = (teams) => {
  const list = teams || [];
  const byId = new Map(list.map((team) => [team._id, team]));

  // A team roots the tree when it has no parent, or when its parent_team_id
  // points at a team that is not in `list` (deleted, or filtered out upstream).
  const childrenByParent = new Map();
  const roots = [];
  for (const team of list) {
    const parentId = team.parent_team_id;
    if (!parentId || parentId === team._id || !byId.has(parentId)) {
      roots.push(team);
      continue;
    }
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent.get(parentId).push(team);
  }

  roots.sort(byName);
  for (const siblings of childrenByParent.values()) siblings.sort(byName);

  const nodes = [];
  const visited = new Set();

  const visit = (team, depth, parentId) => {
    if (visited.has(team._id)) return; // guards cycles in stored data
    visited.add(team._id);
    const children = childrenByParent.get(team._id) || [];
    nodes.push({team, depth, parentId, hasChildren: children.length > 0});
    for (const child of children) visit(child, depth + 1, team._id);
  };

  for (const root of roots) visit(root, 0, null);

  // Teams that only appear inside a cycle are unreachable from any root. Surface
  // them as roots rather than dropping them: the calendar must never silently
  // lose a team because of bad stored data.
  for (const team of [...list].sort(byName)) {
    if (!visited.has(team._id)) visit(team, 0, null);
  }

  return nodes;
};

/**
 * Return the set of team ids nested under `rootId`, at any depth.
 *
 * @param {string} rootId
 * @param {Array<{_id: string, parent_team_id?: string}>} teams
 * @param {Object} [opts]
 * @param {boolean} [opts.includeRoot=false] - when true, include `rootId` itself.
 * @returns {Set<string>}
 */
export const getTeamDescendantIds = (rootId, teams, {includeRoot = false} = {}) => {
  const result = new Set();
  if (!rootId) return result;

  const childrenByParent = new Map();
  for (const team of teams || []) {
    const parentId = team.parent_team_id;
    if (!parentId) continue;
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent.get(parentId).push(team._id);
  }

  if (includeRoot) result.add(rootId);

  // BFS over the subtree; `seen` guards against any pre-existing cycles.
  const queue = [...(childrenByParent.get(rootId) || [])];
  const seen = new Set();
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    result.add(id);
    for (const childId of childrenByParent.get(id) || []) queue.push(childId);
  }
  return result;
};

/** Non-breaking spaces: `<option>` padding is not stylable across browsers. */
const OPTION_INDENT = '  ';

/**
 * Return the selectable parents for a team, in tree order with indented labels.
 *
 * `selfId` and its whole subtree are excluded, which is what keeps the picker
 * cycle-safe. Excluding a subtree can never orphan a remaining option, so the
 * indentation stays contiguous.
 *
 * @param {Array<{_id: string, name?: string, parent_team_id?: string}>} teams
 * @param {string|null} [selfId] - the team being edited, if any.
 * @returns {Array<{id: string, label: string, depth: number}>}
 */
export const buildParentTeamOptions = (teams, selfId = null) => {
  const excluded = selfId
    ? getTeamDescendantIds(selfId, teams, {includeRoot: true})
    : new Set();
  return flattenTeamTree(teams)
    .filter((node) => !excluded.has(node.team._id))
    .map(({team, depth}) => ({
      id: team._id,
      label: OPTION_INDENT.repeat(depth) + team.name,
      depth,
    }));
};

/**
 * Drop the nodes nested under a collapsed team.
 *
 * `flattenTeamTree` emits depth-first pre-order, so a subtree is exactly the
 * run of nodes deeper than its root that immediately follows it — one depth
 * marker is enough, no ancestor sets needed.
 *
 * @param {TeamTreeNode[]} nodes
 * @param {Set<string>|string[]} collapsedIds
 * @returns {TeamTreeNode[]} the input array itself when nothing is collapsed.
 */
export const filterCollapsedSubtrees = (nodes, collapsedIds) => {
  const collapsed = collapsedIds instanceof Set ? collapsedIds : new Set(collapsedIds || []);
  if (collapsed.size === 0) return nodes;

  const result = [];
  let hiddenBelowDepth = null; // depth of the shallowest collapsed ancestor
  for (const node of nodes || []) {
    if (hiddenBelowDepth !== null && node.depth > hiddenBelowDepth) continue;
    hiddenBelowDepth = null;
    result.push(node);
    if (collapsed.has(node.team._id)) hiddenBelowDepth = node.depth;
  }
  return result;
};

/**
 * Narrow the render list to a focused team and everything under it.
 *
 * Depth is re-based so a focused sub-team renders flush left instead of keeping
 * the indentation of a parent that is no longer on screen.
 *
 * @param {TeamTreeNode[]} nodes
 * @param {string|null} rootId
 * @returns {TeamTreeNode[]} the input array itself when nothing is focused.
 */
export const selectTeamSubtree = (nodes, rootId) => {
  if (!rootId) return nodes;
  const list = nodes || [];
  const start = list.findIndex((node) => node.team._id === rootId);
  if (start === -1) return [];

  const base = list[start].depth;
  const subtree = [list[start]];
  for (let i = start + 1; i < list.length && list[i].depth > base; i += 1) {
    subtree.push(list[i]);
  }
  return base === 0 ? subtree : subtree.map((node) => ({...node, depth: node.depth - base}));
};

/**
 * Re-add ancestors that a filter pruned, so the surviving teams keep their place
 * in the tree instead of jumping to the root.
 *
 * Placeholders carry no members and are marked so the row can render as context
 * rather than as a result.
 *
 * @param {Array<Object>} teams - the filtered teams.
 * @param {Array<Object>} allTeams - the unfiltered teams, used to look ancestors up.
 * @returns {Array<Object>} the input array itself when nothing was missing.
 */
export const addStructuralAncestors = (teams, allTeams) => {
  const present = new Set((teams || []).map((team) => team._id));
  const byId = new Map((allTeams || []).map((team) => [team._id, team]));
  const added = [];

  for (const team of teams || []) {
    let parentId = team.parent_team_id;
    const seen = new Set([team._id]); // guards cycles in stored data
    while (parentId && !present.has(parentId) && !seen.has(parentId)) {
      seen.add(parentId);
      const ancestor = byId.get(parentId);
      if (!ancestor) break;
      present.add(parentId);
      added.push({...ancestor, team_members: [], isStructuralPlaceholder: true});
      parentId = ancestor.parent_team_id;
    }
  }

  return added.length === 0 ? teams : [...(teams || []), ...added];
};
