import {describe, expect, it} from 'vitest';
import {getApiErrorMessage} from './apiErrors';

describe('getApiErrorMessage', () => {
  it('reads the first message of a FastAPI validation array', () => {
    const error = {data: {detail: [{msg: 'Invalid country'}, {msg: 'ignored'}]}};
    expect(getApiErrorMessage(error)).toBe('Invalid country');
  });

  it('reads a single detail object', () => {
    expect(getApiErrorMessage({data: {detail: {msg: 'Bad birthday'}}})).toBe('Bad birthday');
  });

  it('reads a plain string detail raised by HTTPException', () => {
    const error = {data: {detail: 'Parent team assignment would create a cycle'}};
    expect(getApiErrorMessage(error)).toBe('Parent team assignment would create a cycle');
  });

  it('falls back when there is no usable detail', () => {
    expect(getApiErrorMessage(undefined)).toBe('An error occurred. Please try again.');
    expect(getApiErrorMessage({})).toBe('An error occurred. Please try again.');
    expect(getApiErrorMessage({data: {detail: ''}})).toBe('An error occurred. Please try again.');
    expect(getApiErrorMessage({data: {detail: []}}, 'Nope')).toBe('Nope');
  });
});
