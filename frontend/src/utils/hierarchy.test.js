import {describe, expect, it} from 'vitest';
import {buildManagerOptions, getReportsUnder} from './hierarchy';

// A is manager of B and C; B is manager of D. (D is A's indirect report.)
const members = [
  {uid: 'a', name: 'A'},
  {uid: 'b', name: 'B', manager_uid: 'a'},
  {uid: 'c', name: 'C', manager_uid: 'a'},
  {uid: 'd', name: 'D', manager_uid: 'b'},
  {uid: 'e', name: 'E'}, // unrelated, no manager
];

describe('getReportsUnder', () => {
  it('returns an empty set when no root is given', () => {
    expect(getReportsUnder('', members)).toEqual(new Set());
  });

  it('returns only direct reports by default', () => {
    expect(getReportsUnder('a', members)).toEqual(new Set(['b', 'c']));
  });

  it('includes the whole subtree when includeIndirect is true', () => {
    expect(getReportsUnder('a', members, {includeIndirect: true}))
      .toEqual(new Set(['b', 'c', 'd']));
  });

  it('includes the root itself when includeRoot is true', () => {
    expect(getReportsUnder('a', members, {includeRoot: true}))
      .toEqual(new Set(['a', 'b', 'c']));
    expect(getReportsUnder('a', members, {includeIndirect: true, includeRoot: true}))
      .toEqual(new Set(['a', 'b', 'c', 'd']));
  });

  it('returns just the root for a leaf member with includeRoot', () => {
    expect(getReportsUnder('d', members, {includeRoot: true})).toEqual(new Set(['d']));
    expect(getReportsUnder('d', members)).toEqual(new Set());
  });

  it('does not loop forever on a pre-existing cycle', () => {
    const cyclic = [
      {uid: 'x', manager_uid: 'y'},
      {uid: 'y', manager_uid: 'x'},
    ];
    expect(getReportsUnder('x', cyclic, {includeIndirect: true}))
      .toEqual(new Set(['y', 'x']));
  });
});

describe('buildManagerOptions', () => {
  it('returns only members who manage at least one other, sorted by name', () => {
    // A manages B and C; B manages D. So A and B are managers; C, D, E are not.
    expect(buildManagerOptions(members)).toEqual([
      {uid: 'a', label: 'A'},
      {uid: 'b', label: 'B'},
    ]);
  });

  it('excludes the given self uid', () => {
    expect(buildManagerOptions(members, 'a')).toEqual([{uid: 'b', label: 'B'}]);
  });

  it('returns an empty array when nobody manages anyone', () => {
    const flat = [{uid: 'a', name: 'A'}, {uid: 'b', name: 'B'}];
    expect(buildManagerOptions(flat)).toEqual([]);
  });

  it('tolerates missing/empty input', () => {
    expect(buildManagerOptions()).toEqual([]);
    expect(buildManagerOptions([])).toEqual([]);
  });
});
