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

test('defines required auth and RBAC helper functions including tfunions@gmail.com owner bootstrap', () => {
  for (const fn of [
    'isSignedIn()',
    'isOwner(uid)',
    'hasRole(roles)',
    'isVerifiedEmail()',
    'isBootstrapOwner()',
    'hasPermission(perm)',
    'isAdmin()',
    'isLead()',
  ]) {
    assert.ok(rulesText.includes(`function ${fn}`), `Missing helper function ${fn}`);
  }
  const bootBlock = extractMatchBlock(rulesText, 'function isBootstrapOwner()');
  assert.ok(bootBlock.includes('tfunions@gmail.com'), 'isBootstrapOwner must include tfunions@gmail.com');
});

test('never grants unconditional public write or read+write access', () => {
  assert.doesNotMatch(rulesText, /allow\s+read\s*,\s*write\s*:\s*if\s+true\b/);
  assert.doesNotMatch(rulesText, /allow\s+write\s*:\s*if\s+true\b/);
});

test('/users/{userId} enforces ownership/lead/HR reads and blocks privilege escalation', () => {
  const block = extractMatchBlock(rulesText, 'match /users/{userId}');
  assert.doesNotMatch(block, /allow\s+read\s*:\s*if\s+true\b/);
  assert.match(block, /isOwner\(userId\)/);
  assert.match(block, /isLead\(\)/);
  assert.match(block, /isAdmin\(\)/);
  assert.match(block, /hasPermission\(['"]edit_team['"]\)/);
  assert.match(block, /hasPermission\(['"]manage_access['"]\)/);
  for (const protectedKey of ['role', 'badges', 'tracks', 'baserowRowId', 'uid', 'team', 'rank', 'roleId', 'roleName']) {
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

test('/staffAccess/{email} restricts reads to self/admin/access-manager and writes to admin/access-manager', () => {
  const block = extractMatchBlock(rulesText, 'match /staffAccess/{email}');
  assert.doesNotMatch(block, /allow\s+read\s*:\s*if\s+true\b/);
  assert.match(block, /userEmail\(\)\s*==\s*email/);
  assert.match(block, /isAdmin\(\)/);
  assert.match(block, /hasPermission\(['"]manage_access['"]\)/);
});

test('/roleDefinitions/{roleId} forbids public reads, requires admin or manage_access writes, and validates fields', () => {
  const block = extractMatchBlock(rulesText, 'match /roleDefinitions/{roleId}');
  assert.doesNotMatch(block, /allow\s+read\s*:\s*if\s+true\b/);
  assert.match(block, /allow\s+read:\s*if\s+isAdmin\(\)\s*\|\|\s*hasStaffRecord\(\)\s*;/);
  assert.match(block, /isAdmin\(\)/);
  assert.match(block, /hasPermission\(['"]manage_access['"]\)/);
  assert.match(block, /request\.resource\.data\.name\s+is\s+string/);
  assert.match(block, /request\.resource\.data\.permissions\s+is\s+list/);
});

test('studio content collections enforce granular per-permission writes and PII protection', () => {
  const teamBlock = extractMatchBlock(rulesText, 'match /teamMembers/{memberId}');
  assert.match(teamBlock, /hasPermission\(['"]edit_team['"]\)/);
  for (const blocked of ['email', 'phone', 'age']) {
    assert.ok(teamBlock.includes(`'${blocked}'`), `/teamMembers must forbid PII field "${blocked}"`);
  }

  const ledgerBlock = extractMatchBlock(rulesText, 'match /ledgerEntries/{entryId}');
  assert.match(ledgerBlock, /hasPermission\(['"]edit_ledger['"]\)/);
  assert.match(ledgerBlock, /amountEgp/);

  const chaptersBlock = extractMatchBlock(rulesText, 'match /chapters/{chapterId}');
  assert.match(chaptersBlock, /hasPermission\(['"]edit_chapters['"]\)/);

  const guidesBlock = extractMatchBlock(rulesText, 'match /guides/{guideId}');
  assert.match(guidesBlock, /hasPermission\(['"]edit_guides['"]\)/);

  const siteCopyBlock = extractMatchBlock(rulesText, 'match /siteCopy/{pageKey}');
  assert.match(siteCopyBlock, /allow\s+read:\s*if\s+true\s*;/);
  assert.match(siteCopyBlock, /hasPermission\(['"]edit_site_copy['"]\)/);

  const siteConfigBlock = extractMatchBlock(rulesText, 'match /siteConfig/{configKey}');
  assert.match(siteConfigBlock, /allow\s+read:\s*if\s+true\s*;/);
  assert.match(siteConfigBlock, /edit_ledger/);
});

test('team dashboard collections (/tasks, /timeLogs, /recognitions) restrict reads and writes to staff/admin', () => {
  for (const header of [
    'match /tasks/{taskId}',
    'match /timeLogs/{logId}',
    'match /recognitions/{recId}',
  ]) {
    const block = extractMatchBlock(rulesText, header);
    assert.doesNotMatch(block, /allow\s+read\s*:\s*if\s+true\b/, `${header} must not be public read`);
    assert.match(block, /isAdmin\(\)/);
    assert.match(block, /hasStaffRecord\(\)|edit_team/);
  }
});

test('/auditLogs/{logId} is append-only for verified staff/admins and readable by admin/access-manager', () => {
  const block = extractMatchBlock(rulesText, 'match /auditLogs/{logId}');
  assert.match(block, /allow\s+read:\s*if\s+isAdmin\(\)(\s*\|\|\s*hasPermission\(['"]manage_access['"]\))?\s*;/);
  assert.match(block, /actorUid\s*==\s*request\.auth\.uid/);
  assert.match(block, /allow\s+update,\s*delete:\s*if\s+false\s*;/);
});

test('/certificates/{serial} allows public verification read and restricts writes to admins or registrars', () => {
  const block = extractMatchBlock(rulesText, 'match /certificates/{serial}');
  assert.match(block, /allow\s+read:\s*if\s+true\s*;/);
  assert.match(block, /isAdmin\(\)/);
  assert.match(block, /manage_certificates/);
});

test('contains default deny catch-all rule', () => {
  const block = extractMatchBlock(rulesText, 'match /{document=**}');
  assert.match(block, /allow\s+read\s*,\s*write\s*:\s*if\s+false\s*;/);
});
