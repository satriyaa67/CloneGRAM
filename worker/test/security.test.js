import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeEqual, bearerToken } from '../src/lib/security.js';

test('safeEqual matches identical strings only', () => {
  assert.equal(safeEqual('abc_123', 'abc_123'), true);
  assert.equal(safeEqual('abc_123', 'abc_124'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
  assert.equal(safeEqual('', ''), false);
  assert.equal(safeEqual(undefined, 'x'), false);
});

test('bearerToken extracts the token', () => {
  const request = new Request('https://x.test', { headers: { authorization: 'Bearer  s3cret ' } });
  assert.equal(bearerToken(request), 's3cret');
  assert.equal(bearerToken(new Request('https://x.test')), null);
});
