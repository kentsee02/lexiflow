import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/utils/password.js';
import { signAuthToken, verifyAuthToken } from '../src/utils/jwt.js';

describe('Password utilities', () => {
  it('hashes passwords with unique salts and verifies correctly', async () => {
    const hashA = await hashPassword('SuperSecret123!');
    const hashB = await hashPassword('SuperSecret123!');

    assert.notEqual(hashA, hashB);
    assert.ok(hashA.startsWith('scrypt$'));
    assert.equal(await verifyPassword('SuperSecret123!', hashA), true);
    assert.equal(await verifyPassword('WrongPassword', hashA), false);
    assert.equal(await verifyPassword('SuperSecret123!', 'malformed-hash'), false);
  });
});

describe('JWT utilities', () => {
  it('signs and verifies valid tokens and rejects tampered tokens', () => {
    const token = signAuthToken({ sub: 'user-123', email: 'learner@example.com' });
    const verified = verifyAuthToken(token);

    assert.deepEqual(verified, { sub: 'user-123', email: 'learner@example.com' });
    assert.equal(verifyAuthToken(`${token}tampered`), null);
    assert.equal(verifyAuthToken('not.a.jwt'), null);
  });
});
