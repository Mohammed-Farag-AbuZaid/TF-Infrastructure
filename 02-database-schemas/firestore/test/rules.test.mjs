import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RULES_PATH = path.resolve(__dirname, '../firestore.rules');
const rulesText = fs.readFileSync(RULES_PATH, 'utf8');

function extractMatchBlock(source, matchHeader) {
  const idx = source.indexOf(matchHeader);
  assert.notEqual(idx, -1, `Expected rule block for "${matchHeader}"`);
  const openIdx = source.indexOf('{', idx + matchHeader.length);
  assert.notEqual(openIdx, -1, `Expected opening brace for "${matchHeader}"`);
  let depth = 0;
  for (let i = openIdx; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(idx, i + 1);
    }
  }
  assert.fail(`Unbalanced braces in block "${matchHeader}"`);
}

test('firestore.rules declares v2 syntax and balanced braces', () => {
  assert.match(rulesText, /rules_version\s*=\s*['"]2['"]\s*;/);
  assert.match(rulesText, /service\s+cloud\.firestore\s*\{/);

  let depth = 0;
  for (const ch of rulesText) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    assert.ok(depth >= 0, 'Brace depth went negative');
  }
  assert.equal(depth, 0, 'All braces in firestore.rules must be balanced');
});

test('defines required auth and RBAC helper functions', () => {
  for (const fn of ['isSignedIn()', 'isOwner(uid)', 'hasRole(roles)', 'isAdmin()', 'isLead()']) {
    assert.ok(rulesText.includes(`function ${fn}`), `Missing helper function ${fn}`);
  }
});

test('never grants unconditional public write or read+write access', () => {
  assert.doesNotMatch(rulesText, /allow\s+read\s*,\s*write\s*:\s*if\s+true\b/);
  assert.doesNotMatch(rulesText, /allow\s+write\s*:\s*if\s+true\b/);
});

test('/users/{userId} enforces ownership/lead reads and blocks privilege escalation', () => {
  const block = extractMatchBlock(rulesText, 'match /users/{userId}');
  assert.doesNotMatch(block, /allow\s+read\s*:\s*if\s+true\b/);
  assert.match(block, /isOwner\(userId\)/);
  assert.match(block, /isLead\(\)/);
  for (const protectedKey of ['role', 'badges', 'tracks', 'baserowRowId', 'uid']) {
    assert.ok(
      block.includes(`'${protectedKey}'`) || block.includes(`"${protectedKey}"`),
      `/users/{userId} must guard privileged field "${protectedKey}"`,
    );
  }
});

test('/usernames/{username} prevents overwriting another user handle', () => {
  const block = extractMatchBlock(rulesText, 'match /usernames/{username}');
  assert.match(block, /allow\s+read/);
  assert.doesNotMatch(block, /allow\s+create\s*:\s*if\s+isSignedIn\(\)\s*;/);
});

test('public catalog collections restrict writes to leads or admins', () => {
  for (const header of [
    'match /opportunities/{opportunityId}',
    'match /allProjects/{projectId}',
    'match /inProgressProjects/{projectId}',
    'match /upcomingProjects/{projectId}',
  ]) {
    const block = extractMatchBlock(rulesText, header);
    assert.match(block, /allow\s+read/);
    assert.match(block, /isLead\(\)|isAdmin\(\)/, `${header} writes must require lead/admin`);
  }
});

test('ideas require signed-in bounded creates and lead moderation', () => {
  const block = extractMatchBlock(rulesText, 'match /ideas/{ideaId}');
  assert.match(block, /allow\s+create:\s*if\s+isSignedIn\(\)/);
  assert.match(block, /allow\s+update,\s*delete:\s*if\s+isLead\(\)/);
});

test('private intake collections forbid blanket public reads', () => {
  for (const header of [
    'match /volunteers/{applicationId}',
    'match /donations/{donationId}',
  ]) {
    const block = extractMatchBlock(rulesText, header);
    assert.doesNotMatch(block, /allow\s+read\s*:\s*if\s+true\b/, `${header} must not allow blanket public read`);
  }
});

test('/certificates/{serial} allows public verification read and restricts writes to admins', () => {
  const block = extractMatchBlock(rulesText, 'match /certificates/{serial}');
  assert.match(block, /allow\s+read:\s*if\s+true\s*;/);
  assert.match(block, /allow\s+write:\s*if\s+isAdmin\(\)\s*;/);
});

test('contains default deny catch-all rule', () => {
  const block = extractMatchBlock(rulesText, 'match /{document=**}');
  assert.match(block, /allow\s+read\s*,\s*write\s*:\s*if\s+false\s*;/);
});
