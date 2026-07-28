import {describe, expect, it} from 'vitest';
import {
  addStructuralAncestors,
  buildParentTeamOptions,
  buildTeamLeaderOptions,
  filterCollapsedSubtrees,
  flattenTeamTree,
  getSubtreeMemberCounts,
  getTeamDescendantIds,
  selectTeamSubtree,
} from './teamHierarchy';

// Engineering > (Backend > Payments, Frontend); Sales is an unrelated root.
const teams = [
  {_id: 'eng', name: 'Engineering'},
  {_id: 'be', name: 'Backend', parent_team_id: 'eng'},
  {_id: 'pay', name: 'Payments', parent_team_id: 'be'},
  {_id: 'fe', name: 'Frontend', parent_team_id: 'eng'},
  {_id: 'sales', name: 'Sales'},
];

const ids = (nodes) => nodes.map((node) => node.team._id);

describe('flattenTeamTree', () => {
  it('orders roots then children depth-first', () => {
    expect(ids(flattenTeamTree(teams))).toEqual(['eng', 'be', 'pay', 'fe', 'sales']);
  });

  it('sorts siblings by name at every level', () => {
    // Backend sorts before Frontend, Engineering before Sales.
    const shuffled = [teams[4], teams[3], teams[2], teams[1], teams[0]];
    expect(ids(flattenTeamTree(shuffled))).toEqual(['eng', 'be', 'pay', 'fe', 'sales']);
  });

  it('annotates depth, parentId and hasChildren', () => {
    const byId = Object.fromEntries(flattenTeamTree(teams).map((n) => [n.team._id, n]));
    expect(byId.eng).toMatchObject({depth: 0, parentId: null, hasChildren: true});
    expect(byId.be).toMatchObject({depth: 1, parentId: 'eng', hasChildren: true});
    expect(byId.pay).toMatchObject({depth: 2, parentId: 'be', hasChildren: false});
    expect(byId.sales).toMatchObject({depth: 0, parentId: null, hasChildren: false});
  });

  it('treats an unknown parent_team_id as a root', () => {
    const orphan = [{_id: 'x', name: 'X', parent_team_id: 'gone'}];
    expect(flattenTeamTree(orphan)).toEqual([
      {team: orphan[0], depth: 0, parentId: null, hasChildren: false},
    ]);
  });

  it('treats a self-referencing team as a root', () => {
    const selfish = [{_id: 'x', name: 'X', parent_team_id: 'x'}];
    expect(flattenTeamTree(selfish)[0]).toMatchObject({depth: 0, parentId: null});
  });

  it('keeps every team exactly once when the stored data contains a cycle', () => {
    const cyclic = [
      {_id: 'a', name: 'A', parent_team_id: 'b'},
      {_id: 'b', name: 'B', parent_team_id: 'a'},
      {_id: 'c', name: 'C'},
    ];
    const result = flattenTeamTree(cyclic);
    expect(result).toHaveLength(3);
    expect(new Set(ids(result))).toEqual(new Set(['a', 'b', 'c']));
  });

  it('preserves the original team object references', () => {
    expect(flattenTeamTree(teams)[0].team).toBe(teams[0]);
  });

  it('tolerates missing/empty input', () => {
    expect(flattenTeamTree()).toEqual([]);
    expect(flattenTeamTree([])).toEqual([]);
  });
});

describe('getTeamDescendantIds', () => {
  it('returns the whole subtree', () => {
    expect(getTeamDescendantIds('eng', teams)).toEqual(new Set(['be', 'pay', 'fe']));
  });

  it('includes the root when asked', () => {
    expect(getTeamDescendantIds('be', teams, {includeRoot: true}))
      .toEqual(new Set(['be', 'pay']));
  });

  it('returns an empty set for a leaf, an unknown id or no id', () => {
    expect(getTeamDescendantIds('pay', teams)).toEqual(new Set());
    expect(getTeamDescendantIds('nope', teams)).toEqual(new Set());
    expect(getTeamDescendantIds('', teams)).toEqual(new Set());
  });

  it('does not loop forever on a cycle', () => {
    const cyclic = [
      {_id: 'a', parent_team_id: 'b'},
      {_id: 'b', parent_team_id: 'a'},
    ];
    expect(getTeamDescendantIds('a', cyclic)).toEqual(new Set(['b', 'a']));
  });
});

describe('getSubtreeMemberCounts', () => {
  // Fed through the real flattenTeamTree, so pre-order and parentId resolution are
  // exercised rather than hand-faked.
  const counts = (list) => getSubtreeMemberCounts(flattenTeamTree(list));
  const staffed = (id, howMany, parentId) => ({
    _id: id,
    name: id,
    parent_team_id: parentId,
    team_members: Array.from({length: howMany}, (_, i) => ({uid: `${id}-${i}`})),
  });

  it('sums the children of a team that has no members of its own', () => {
    // The reported bug: this parent used to render (0).
    const result = counts([
      staffed('core', 0),
      staffed('baldr', 6, 'core'),
      staffed('data', 2, 'core'),
    ]);
    expect(result.get('core')).toBe(8);
    expect(result.get('baldr')).toBe(6);
  });

  it('counts a team and its descendants together', () => {
    const result = counts([staffed('core', 2), staffed('baldr', 6, 'core')]);
    expect(result.get('core')).toBe(8);
  });

  it('carries grandchildren all the way to the root', () => {
    const result = counts([
      staffed('eng', 1),
      staffed('be', 2, 'eng'),
      staffed('pay', 4, 'be'),
    ]);
    expect(result.get('eng')).toBe(7);
    expect(result.get('be')).toBe(6);
    expect(result.get('pay')).toBe(4);
  });

  it('leaves a leaf team at its own roster size', () => {
    expect(counts([staffed('sales', 3)]).get('sales')).toBe(3);
  });

  it('treats a team as a root when its parent is not in the list', () => {
    // The parent was pruned by a filter: the orphan keeps its own count and cannot
    // leak it into whatever else happens to be rendered.
    const result = counts([staffed('be', 2, 'missing'), staffed('sales', 3)]);
    expect(result.get('be')).toBe(2);
    expect(result.get('sales')).toBe(3);
    expect(result.has('missing')).toBe(false);
  });

  it('ignores a parentId that is not among the nodes', () => {
    // flattenTeamTree nulls an unresolvable parent, so only a hand-built node list
    // reaches the `totals.has` guard. Covered directly because the helper is
    // exported and nothing stops a caller assembling nodes itself.
    const result = getSubtreeMemberCounts([
      {team: staffed('be', 2), parentId: 'ghost', depth: 1, hasChildren: false},
    ]);
    expect(result.get('be')).toBe(2);
    expect(result.has('ghost')).toBe(false);
  });

  it('counts each team once when the stored data contains a cycle', () => {
    // a <-> b: flattenTeamTree roots whichever it reaches first and keeps the other
    // as its child, so the pair reads as a two-team branch rather than double
    // counting. Pinned per team, not just as a total, so a duplicated non-root
    // cannot hide inside a correct-looking sum.
    const nodes = flattenTeamTree([staffed('a', 2, 'b'), staffed('b', 3, 'a')]);
    expect(nodes.map((node) => [node.team._id, node.parentId]))
      .toEqual([['a', null], ['b', 'a']]);

    const result = getSubtreeMemberCounts(nodes);
    expect(result.get('a')).toBe(5); // 2 of its own + b's 3
    expect(result.get('b')).toBe(3); // its own only; the edge back to a is dropped
  });

  it('tolerates missing input', () => {
    expect(getSubtreeMemberCounts(undefined)).toEqual(new Map());
    expect(getSubtreeMemberCounts([])).toEqual(new Map());
    // A team object without a team_members array at all.
    expect(getSubtreeMemberCounts(flattenTeamTree([{_id: 'x', name: 'x'}])).get('x')).toBe(0);
  });
});

describe('buildParentTeamOptions', () => {
  it('lists every team in tree order with an indented label', () => {
    expect(buildParentTeamOptions(teams)).toEqual([
      {id: 'eng', label: 'Engineering', depth: 0},
      {id: 'be', label: '  Backend', depth: 1},
      {id: 'pay', label: '    Payments', depth: 2},
      {id: 'fe', label: '  Frontend', depth: 1},
      {id: 'sales', label: 'Sales', depth: 0},
    ]);
  });

  it('excludes the edited team and its whole subtree', () => {
    expect(buildParentTeamOptions(teams, 'be').map((o) => o.id)).toEqual(['eng', 'fe', 'sales']);
    expect(buildParentTeamOptions(teams, 'eng').map((o) => o.id)).toEqual(['sales']);
  });

  it('tolerates missing input', () => {
    expect(buildParentTeamOptions()).toEqual([]);
    expect(buildParentTeamOptions([], 'be')).toEqual([]);
  });
});

describe('filterCollapsedSubtrees', () => {
  const nodes = flattenTeamTree(teams);

  it('returns the same array reference when nothing is collapsed', () => {
    expect(filterCollapsedSubtrees(nodes, [])).toBe(nodes);
    expect(filterCollapsedSubtrees(nodes, new Set())).toBe(nodes);
  });

  it('hides the descendant teams of a collapsed parent', () => {
    expect(ids(filterCollapsedSubtrees(nodes, ['be']))).toEqual(['eng', 'be', 'fe', 'sales']);
  });

  it('keeps siblings of a collapsed parent', () => {
    expect(ids(filterCollapsedSubtrees(nodes, ['eng']))).toEqual(['eng', 'sales']);
  });

  it('handles a collapsed team nested inside a collapsed subtree', () => {
    expect(ids(filterCollapsedSubtrees(nodes, ['eng', 'be']))).toEqual(['eng', 'sales']);
  });

  it('accepts an array or a Set', () => {
    expect(ids(filterCollapsedSubtrees(nodes, new Set(['be']))))
      .toEqual(ids(filterCollapsedSubtrees(nodes, ['be'])));
  });
});

describe('selectTeamSubtree', () => {
  const nodes = flattenTeamTree(teams);

  it('returns the same array reference when nothing is focused', () => {
    expect(selectTeamSubtree(nodes, null)).toBe(nodes);
    expect(selectTeamSubtree(nodes, '')).toBe(nodes);
  });

  it('returns the focused team and its whole subtree', () => {
    expect(ids(selectTeamSubtree(nodes, 'eng'))).toEqual(['eng', 'be', 'pay', 'fe']);
  });

  it('rebases depth so a focused child renders flush left', () => {
    expect(selectTeamSubtree(nodes, 'be').map((n) => n.depth)).toEqual([0, 1]);
  });

  it('returns just the team for a leaf', () => {
    expect(ids(selectTeamSubtree(nodes, 'sales'))).toEqual(['sales']);
  });

  it('returns an empty list when the focused team is absent', () => {
    expect(selectTeamSubtree(nodes, 'gone')).toEqual([]);
  });
});

describe('addStructuralAncestors', () => {
  it('adds a pruned parent back as a member-less placeholder', () => {
    const filtered = [{_id: 'be', name: 'Backend', parent_team_id: 'eng', team_members: [{uid: 'm'}]}];
    const result = addStructuralAncestors(filtered, teams);
    expect(result.map((t) => t._id)).toEqual(['be', 'eng']);
    expect(result[1]).toMatchObject({_id: 'eng', team_members: [], isStructuralPlaceholder: true});
  });

  it('walks the whole ancestor chain', () => {
    const filtered = [{_id: 'pay', name: 'Payments', parent_team_id: 'be', team_members: []}];
    expect(addStructuralAncestors(filtered, teams).map((t) => t._id)).toEqual(['pay', 'be', 'eng']);
  });

  it('does not duplicate an ancestor that survived the filter', () => {
    const filtered = [
      {_id: 'eng', name: 'Engineering', team_members: []},
      {_id: 'pay', name: 'Payments', parent_team_id: 'be', team_members: []},
    ];
    expect(addStructuralAncestors(filtered, teams).map((t) => t._id)).toEqual(['eng', 'pay', 'be']);
  });

  it('returns the same array reference when nothing is missing', () => {
    const filtered = [{_id: 'sales', name: 'Sales', team_members: []}];
    expect(addStructuralAncestors(filtered, teams)).toBe(filtered);
  });

  it('stops on a cycle', () => {
    const cyclic = [
      {_id: 'a', name: 'A', parent_team_id: 'b'},
      {_id: 'b', name: 'B', parent_team_id: 'a'},
    ];
    const result = addStructuralAncestors([cyclic[0]], cyclic);
    expect(result.map((t) => t._id)).toEqual(['a', 'b']);
  });
});

describe('buildTeamLeaderOptions', () => {
  // Ada and Bob are in Engineering, Cleo in Payments; a second Ada tests the tie-break.
  const staffedTeams = [
    {
      _id: 'eng',
      name: 'Engineering',
      team_members: [
        {uid: 'u-bob', name: 'Bob'},
        {uid: 'u-ada', name: 'Ada'},
      ],
    },
    {_id: 'pay', name: 'Payments', team_members: [{uid: 'u-cleo', name: 'Cleo'}]},
  ];

  it('labels every member with their team', () => {
    expect(buildTeamLeaderOptions(staffedTeams)).toEqual([
      {uid: 'u-ada', label: 'Ada (Engineering)'},
      {uid: 'u-bob', label: 'Bob (Engineering)'},
      {uid: 'u-cleo', label: 'Cleo (Payments)'},
    ]);
  });

  it('sorts by member name across teams rather than grouping by team', () => {
    const labels = buildTeamLeaderOptions(staffedTeams).map((o) => o.label);
    expect(labels).toEqual(['Ada (Engineering)', 'Bob (Engineering)', 'Cleo (Payments)']);
  });

  it('breaks ties between identically named members on team name', () => {
    const withDuplicate = [
      {_id: 'pay', name: 'Payments', team_members: [{uid: 'u-ada2', name: 'Ada'}]},
      {_id: 'eng', name: 'Engineering', team_members: [{uid: 'u-ada', name: 'Ada'}]},
    ];
    expect(buildTeamLeaderOptions(withDuplicate).map((o) => o.uid)).toEqual(['u-ada', 'u-ada2']);
  });

  it('leaves out archived members', () => {
    const withArchived = [
      {_id: 'eng', name: 'Engineering', team_members: [
        {uid: 'u-ada', name: 'Ada'},
        {uid: 'u-gone', name: 'Gone', is_deleted: true},
      ]},
    ];
    expect(buildTeamLeaderOptions(withArchived).map((o) => o.uid)).toEqual(['u-ada']);
  });

  it('leaves out archived teams', () => {
    const withArchivedTeam = [
      ...staffedTeams,
      {_id: 'old', name: 'Old', is_deleted: true, team_members: [{uid: 'u-old', name: 'Aaron'}]},
    ];
    expect(buildTeamLeaderOptions(withArchivedTeam).map((o) => o.uid)).not.toContain('u-old');
  });

  it('leaves out structural placeholder teams', () => {
    // Placeholders are filter artefacts whose members are not in the rendered list.
    const withPlaceholder = [
      ...staffedTeams,
      {_id: 'ghost', name: 'Ghost', isStructuralPlaceholder: true,
       team_members: [{uid: 'u-ghost', name: 'Aaron'}]},
    ];
    expect(buildTeamLeaderOptions(withPlaceholder).map((o) => o.uid)).not.toContain('u-ghost');
  });

  it('tolerates teams without members and empty input', () => {
    expect(buildTeamLeaderOptions(teams)).toEqual([]);
    expect(buildTeamLeaderOptions([])).toEqual([]);
    expect(buildTeamLeaderOptions(undefined)).toEqual([]);
  });
});
