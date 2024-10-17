// server/src/utils.test.ts

import { expect } from 'chai';
import { getWordAt, mergeArrayToUnique, range } from '../utils';

describe('Utility Functions', () => {
  describe('mergeArrayToUnique', () => {
    it('should merge two arrays with unique elements', () => {
      const a = [1, 2, 3];
      const b = [4, 5, 6];
      const result = mergeArrayToUnique(a, b);
      expect(result).to.have.members([1, 2, 3, 4, 5, 6]);
    });

    it('should merge two arrays with some common elements', () => {
      const a = [1, 2, 3];
      const b = [3, 4, 5];
      const result = mergeArrayToUnique(a, b);
      expect(result).to.have.members([1, 2, 3, 4, 5]);
    });

    it('should merge two arrays with all common elements', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3];
      const result = mergeArrayToUnique(a, b);
      expect(result).to.have.members([1, 2, 3]);
    });

    it('should merge two arrays with a custom predicate', () => {
      const a = [{ id: 1 }, { id: 2 }];
      const b = [{ id: 2 }, { id: 3 }];
      const predicate = (a: any, b: any) => a.id === b.id;
      const result = mergeArrayToUnique(a, b, predicate);
      expect(result).to.deep.include.members([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });
  });

  describe('range', () => {
    it('should generate a range with valid start and end values', () => {
      const result = range(1, 5);
      expect(result).to.deep.equal([1, 2, 3, 4]);
    });

    it('should generate an empty array when start equals end', () => {
      const result = range(3, 3);
      expect(result).to.deep.equal([]);
    });

    it('should throw an error when start is greater than end', () => {
      expect(() => range(5, 1)).to.throw("Start value must be less than or equal to end value.");
    });
  });

  describe('getWordAt', () => {
    it('should return null when position is out of bounds', () => {
      expect(getWordAt('hello world', -1)).to.be.null;
      expect(getWordAt('hello world', 11)).to.be.null;
    });

    it('should return the word at the start position', () => {
      expect(getWordAt('hello world', 0)).to.equal('hello');
    });

    it('should return the word at the middle position', () => {
      expect(getWordAt('hello world', 3)).to.equal('hello');
    });

    it('should return the word at the end position', () => {
      expect(getWordAt('hello world', 4)).to.equal('hello');
    });

    it('should return the word at the start of the second word', () => {
      expect(getWordAt('hello world', 6)).to.equal('world');
    });

    it('should return the word at the middle of the second word', () => {
      expect(getWordAt('hello world', 8)).to.equal('world');
    });

    it('should return the word at the end of the second word', () => {
      expect(getWordAt('hello world', 10)).to.equal('world');
    });

    it('should return null when position is at a non-word character', () => {
      expect(getWordAt('hello world', 5)).to.be.null;
    });

    it('should return null for an empty string', () => {
      expect(getWordAt('', 0)).to.be.null;
    });
  });
});