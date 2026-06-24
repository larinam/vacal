import {describe, expect, it} from 'vitest';
import {getReportsUnder} from './hierarchy';

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
