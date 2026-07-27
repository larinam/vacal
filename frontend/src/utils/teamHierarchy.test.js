import {describe, expect, it} from 'vitest';
import {
  addStructuralAncestors,
  buildParentTeamOptions,
  filterCollapsedSubtrees,
  flattenTeamTree,
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
