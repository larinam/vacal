/**
 * Reporting-hierarchy helpers built on the `manager_uid` field that each team
 * member carries (a reference to another member's `uid`).
 */

/**
 * Return the set of member uids that report to `rootUid`.
 *
 * @param {string} rootUid - uid of the manager to start from.
 * @param {Array<{uid: string, manager_uid?: string}>} members - all members.
 * @param {Object} [opts]
 * @param {boolean} [opts.includeIndirect=false] - when true, include the whole
 *   subtree (reports-of-reports); otherwise only direct reports.
 * @param {boolean} [opts.includeRoot=false] - when true, include `rootUid` itself.
 * @returns {Set<string>} set of uids visible under `rootUid`.
 */
export const getReportsUnder = (
  rootUid,
  members,
  {includeIndirect = false, includeRoot = false} = {}
) => {
  const result = new Set();
  if (!rootUid) return result;

  // Build managerUid -> [childUid] adjacency map.
  const childrenByManager = new Map();
  for (const m of members || []) {
    const managerUid = m.manager_uid;
    if (!managerUid) continue;
    if (!childrenByManager.has(managerUid)) {
      childrenByManager.set(managerUid, []);
    }
    childrenByManager.get(managerUid).push(m.uid);
  }

  if (includeRoot) result.add(rootUid);

  if (!includeIndirect) {
    for (const childUid of childrenByManager.get(rootUid) || []) {
      result.add(childUid);
    }
    return result;
  }

  // BFS over the subtree; `seen` guards against any pre-existing cycles.
  const queue = [...(childrenByManager.get(rootUid) || [])];
  const seen = new Set();
  while (queue.length) {
    const uid = queue.shift();
    if (seen.has(uid)) continue;
    seen.add(uid);
    result.add(uid);
    for (const childUid of childrenByManager.get(uid) || []) {
      queue.push(childUid);
    }
  }
  return result;
};
