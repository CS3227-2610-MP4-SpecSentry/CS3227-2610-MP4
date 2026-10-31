"""Coordinator-owned preparation inputs. No application writes or acceptance execution."""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
RUN = Path(__file__).resolve().parents[1]
CLI = ROOT / 'workflow/reviewer/scripts/workflow.py'
NODE = 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'

def invoke(*args):
    result = subprocess.run([sys.executable, '-B', str(CLI), '--run', str(RUN.relative_to(ROOT)), *args], cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout)
    return result.stdout

def ingest(kind, name, data):
    target = RUN / 'inputs' / (name + '.json')
    target.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
    return invoke(kind, '--input', str(target.relative_to(ROOT)))

shared = ['src/shared/src/contracts/revocation.ts', 'src/shared/src/contracts/release.ts',
          'src/shared/src/contracts/reviewer.ts', 'src/shared/src/contracts/revision-cycle.ts', 'src/shared/src/index.ts']
fixtures = ['src/server/test/' + name for name in ['reviewer-seed.integration.ts', 'demo-seed.integration.ts',
 'manual-review.integration.ts', 'proposal-lifecycle.integration.ts', 'notifications.integration.ts',
 'reviews.integration.ts', 'submitted-access.integration.ts', 'patch-risk.integration.ts', 'ai-fixtures.ts']]
fixtures += ['src/server/src/reviews/seed-reviewer.ts', 'workflow/tests/browser/fixtures/reviewer-intake.ts',
 'workflow/tests/browser/fixtures/reviewer-revision-cycle.ts', 'workflow/tests/browser/fixtures/reviewer-patch-risk.ts']
assignments = [
 {'id': 'foundation', 'agent': 'foundation', 'paths': shared + fixtures + [
 'src/server/prisma/schema.prisma', 'src/server/prisma/migrations/20261026160000_approval_revocation',
 'src/server/src/releases/release-locks.ts', 'src/server/src/activity/activity.service.ts',
 'src/server/test/approval-revocation-contracts.spec.ts', 'src/server/test/release-foundation.integration.ts'], 'dependencies': []},
 {'id': 'reviewer', 'agent': 'reviewer', 'paths': ['src/server/src/reviews/approval-revocation.service.ts',
 'src/server/src/reviews/reviews.controller.ts', 'src/server/src/reviews/reviews.service.ts',
 'src/server/src/reviews/reviews.module.ts', 'src/server/src/reviews/manual-review.ts',
 'src/server/src/proposals/proposals.service.ts', 'src/server/test/approval-revocation.integration.ts'], 'dependencies': ['foundation']},
 {'id': 'release', 'agent': 'release', 'paths': ['src/server/src/releases/releases.module.ts',
 'src/server/src/releases/releases.controller.ts', 'src/server/src/releases/releases.service.ts',
 'src/server/src/notifications/notifications.controller.ts', 'src/server/src/notifications/notifications.service.ts',
 'src/server/src/notifications/notifications.module.ts', 'src/server/test/release-revocation.integration.ts',
 'src/server/test/approval-revocation-races.integration.ts'], 'dependencies': ['foundation']},
 {'id': 'ui', 'agent': 'ui', 'paths': ['src/client/src/features/reviewer',
 'workflow/tests/browser/reviewer-revocation.spec.ts', 'workflow/tests/browser/fixtures/reviewer-revocation.ts'],
 'dependencies': ['foundation', 'reviewer', 'release']},
]
for assignment in assignments:
    assignment['role'] = 'implementer'
    ingest('assignment', 'assignment-' + assignment['id'], assignment)

# Use current executable prerequisites, not a future fixture that blocks its own owner.
previous = json.loads((ROOT / 'logs/ngkhengyang/reviewer/2026-10-26-patch-risk-i3-implementation/state.json').read_text())
prereqs = previous['verification_checks']
for key in ['runtime', 'database-preflight', 'browser-runtime', 'baseline-fixture']:
    check = dict(prereqs[key])
    if key == 'database-preflight':
        # Preparation checks existing migration status without applying migrations.
        check['argv'] = [NODE, '-e', "const {Client}=require('pg'),{readdirSync}=require('node:fs'); (async()=>{const u=new URL(process.env.TEST_DATABASE_URL);if(!['127.0.0.1','localhost'].includes(u.hostname)||u.pathname!='/specsentry_reviewer_intake_test')throw Error();const c=new Client({connectionString:u.href,connectionTimeoutMillis:5000});try{await c.connect();const r=await c.query('SELECT current_database() AS name');if(r.rows[0].name!=='specsentry_reviewer_intake_test')throw Error();const m=await c.query('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');const applied=new Set(m.rows.map(x=>x.migration_name));for(const f of readdirSync('src/server/prisma/migrations',{withFileTypes:true}).filter(x=>x.isDirectory()))if(!applied.has(f.name))throw Error();console.log('Disposable connection and current migration ledger passed');}finally{await c.end();}})().catch(()=>{console.error('Disposable database connection/migration status failed');process.exit(1);});"]
    ingest('check-register', 'check-' + key, check)

common_paths = ['package.json', 'package-lock.json', 'src/shared/src', 'src/server/src/identity',
 'src/server/src/proposals', 'src/server/src/activity', 'src/server/prisma', 'src/server/test/business-fixtures.ts',
 'src/server/package.json', 'src/server/jest.integration.config.cjs']

def check(key, kind, argv, paths, db=False):
    return {'id': key, 'kind': kind, 'argv': argv, 'paths': paths, 'depends_on': ['runtime'],
     'resources': ['database'] if db else [], 'environment': ['TEST_DATABASE_URL'] if db else [],
     'database': {'environment': 'TEST_DATABASE_URL', 'name': 'specsentry_reviewer_intake_test'} if db else None, 'timeout': 180}

groups = {
 'foundation-contracts': ('unit', 'src/server/test/approval-revocation-contracts.spec.ts'),
 'foundation-data': ('integration', 'src/server/test/release-foundation.integration.ts'),
 'reviewer-revocation': ('integration', 'src/server/test/approval-revocation.integration.ts'),
 'release-revocation': ('integration', 'src/server/test/release-revocation.integration.ts'),
 'revocation-races': ('integration', 'src/server/test/approval-revocation-races.integration.ts'),
}
case_rows = []
def case(cid, req, kind, owner, group, scenario, expected, events=None):
    case_rows.append({'id': cid, 'requirement': req, 'kind': kind, 'owner': owner, 'check': group,
     'scenario': scenario, 'preconditions': 'Enabled role accounts, persisted sessions/CSRF; immutable current submitted revision and effective human approval unless denial case specifies otherwise.',
     'events': events or [], 'expected': expected})

for req, cid, expected in [
 ('REQ-REV-016','revoke-unattached','One invalidation; CHANGES_REQUESTED; same assigned Reviewer; original approval retained; activity commits together.'),
 ('REQ-REV-004','revoke-attached-freeze','Ordinary finding/coverage and Contributor revision remain frozen IN_RELEASE until explicit removal.'),
 ('REQ-REV-005','revoke-decision-round','Another decision fails until Contributor resubmission; new decision uses new revision.'),
 ('REQ-REV-006','revoke-history','Prior decision/revision immutable; actor/time/reason/cause/approval provenance appended and visible only in authorized human history.')]:
    case(cid,req,'normal','reviewer' if req!='REQ-REV-004' else 'release',
         'reviewer-revocation' if req!='REQ-REV-004' else 'release-revocation',cid,expected)
for cid, kind, scenario, expected in [
 ('revoke-access','authorization','Nonassignee, Contributor and Maintainer call revoke','403 without protected replay/body or business change.'),
 ('revoke-session','authorization','Absent/expired/disabled/version-mismatched session; missing/mismatched CSRF','401/403 as applicable; no invalidation/activity/notice.'),
 ('revoke-stale','lifecycle','Stale proposal, assignment/generation, revision, decision mutationVersion or candidate context','409; no retargeting or partial writes.'),
 ('revoke-released','lifecycle','Proposal or candidate is RELEASED','409; immutable snapshot/decision/history unchanged.'),
 ('revoke-invalid','lifecycle','Approval already invalid, wrong approval or no effective approval','409 without duplicate invalidation.'),
 ('revoke-idempotency','boundary','Same key/body replay; changed body; expired key','One committed outcome for live identical key; changed body 409; expiry revalidates current state.'),
 ('revoke-replay-access','authorization','Replay after assignment/access loss','Deny before original outcome disclosure.'),
 ('revoke-rollback','rollback','Inject failures at invalidation/root/activity/idempotency/notice writes','Entire business transition rolls back; only separate restricted rejection audit may remain.')]:
    case(cid,'REQ-REV-016',kind,'reviewer','reviewer-revocation',scenario,expected)
for cid, scenario, expected in [
 ('revoke-reason-empty','Empty/whitespace reason','422'),
 ('revoke-reason-limit','2000/2001 normalized Unicode code points including astral/CRLF','2000 accepted; 2001 rejected without truncation'),
 ('revoke-strict-body','Unknown fields, actor/state injection, malformed versions/context/key','422; 413 above JSON body cap')]:
    case(cid,'REQ-REV-016','boundary','foundation','foundation-contracts',scenario,expected)
for cid, scenario, expected in [
 ('revoke-foundation-provenance','Migrate existing reopening invalidations and append explicit revocation','Original evidence preserved; cause and scoped provenance constrained'),
 ('revoke-foundation-fixture','Normalized role fixtures and new FK cleanup','Fixtures repeat safely on explicit test database; all new FK cleanup covered')]:
    case(cid,'REQ-REV-016','normal','foundation','foundation-data',scenario,expected)
for cid, kind, scenario, expected in [
 ('revoke-attached','normal','Revoke item in real OPEN candidate created through production operations','Keep membership/IN_RELEASE; invalidate immediately; candidate version advances; durable creator notice contains candidate/proposal/reviewer/reason.'),
 ('revoke-readiness','normal','Readiness and publish with revoked member','Computed blocker and 409 publish; no release snapshot.'),
 ('revoke-notice-ack','normal','Creator opens candidate and acknowledges revocation notice','Read marker only; approval/blocker/smoke/contentVersion unchanged.'),
 ('revoke-notice-scope','authorization','Other accounts/readers acknowledge or list creator notice','Recipient and object scope enforced; no access via IDs or cursor.'),
 ('revoke-remove','lifecycle','Creator explicitly removes revoked item','Detach; CHANGES_REQUESTED; contentVersion advances; old smoke invalidated; unavailable assignee handled atomically.'),
 ('release-ownership','authorization','Noncreator attempts candidate edit/add/remove/smoke/publish','403 with no partial membership/activity/snapshot changes.'),
 ('release-gates','boundary','Empty candidate, missing rollback/current PASS, uncovered required criterion, HIGH/CRITICAL, stale revision or duplicate/invalid semantic version','409/422 as appropriate; all gates rechecked inside actual publish transaction.'),
 ('release-rollback','rollback','Inject snapshot/member/candidate/activity/idempotency/notice failure','All business state and evidence roll back.')]:
    case(cid,'REQ-REV-016',kind,'release','release-revocation',scenario,expected)

races = [
 ('revoke-publish-revoke-first','Revoke approval','Publish candidate','Revocation commits; publication fails all-or-nothing; membership stays attached IN_RELEASE; one notice, no snapshot.'),
 ('revoke-publish-publish-first','Publish candidate','Revoke approval','Publication commits RELEASED snapshot; revocation rejected; no invalidation/notice.'),
 ('revoke-remove-revoke-first','Revoke approval','Remove member','Revocation then explicitly refreshed removal yields CHANGES_REQUESTED; stale removal conflicts; retained notice/history.'),
 ('revoke-remove-remove-first','Remove member','Revoke approval','Old attached-context revocation conflicts; removal preserves valid approval APPROVED.'),
 ('revoke-reopen-revoke-first','Revoke unattached approval','Owner reopen','One invalidation/activity winner, retained Reviewer, stale owner request conflicts.'),
 ('revoke-reopen-reopen-first','Owner reopen','Revoke unattached approval','Owner invalidation commits; revocation conflicts; no revoke notice.'),
 ('revoke-duplicate-same-key','Revoke with key K','Same revoke key K/body','Single invalidation/activity/notice; both authorized responses same committed result.'),
 ('revoke-duplicate-different-keys','Revoke with key K','Revoke with key L or changed body','Exactly one mutation; other state/hash conflict.'),
 ('revoke-disable-disable-first','Disable account','Revoke approval','Disabled actor denied, no revocation business writes.'),
 ('revoke-disable-revoke-first','Revoke approval','Disable account','Revocation authorized at commit; disable later releases newly unfinished assignment with preserved approval/revocation history.'),
 ('revoke-session-invalidate-first','Invalidate/logout persisted session','Revoke approval','Revocation denied; no invalidation/activity/notice.'),
 ('revoke-session-revoke-first','Revoke approval','Invalidate/logout persisted session','Only authorized revocation commits before session deletion.'),
 ('revoke-attach-attach-first','Attach proposal','Revoke old unattached context','409 revocation; no silent attached operation or notice.'),
 ('revoke-attach-revoke-first','Revoke unattached approval','Attach proposal','Attachment fails approval/version gate; no membership fragment.'),
]
for cid, first, second, expected in races:
    case(cid,'REQ-REV-016','concurrency','release','revocation-races',cid,expected,[first,second])
for cid, scenario, expected in [
 ('revoke-ui','Eligible unattached and attached real API flows','Reason required; impact text, success and original/revoked history visible; no released action.'),
 ('revoke-ui-recovery','Validation/network/conflict and session/access failure','Reason retained for recoverable errors; stale refresh required; original uncertain-retry key retained; protected memory cleared on access loss.'),
 ('revoke-ui-accessibility','Keyboard and escaped hostile reason','Labels/focus/status text work; reason never executes HTML.')]:
    case(cid,'REQ-REV-016','normal','ui','revocation-browser',scenario,expected)

for key, (kind, test_path) in groups.items():
    ids = [c['id'] for c in case_rows if c['check']==key]
    config = 'src/server/jest.integration.config.cjs' if kind=='integration' else 'src/server/jest.config.cjs'
    argv = [NODE,'node_modules/jest/bin/jest.js','--config',config,'--runInBand','--runTestsByPath',test_path,'--testNamePattern','|'.join(ids)]
    ingest('check-register','check-'+key,check(key,kind,argv,common_paths+[test_path,'src/server/src/releases','src/server/src/notifications','src/server/src/reviews'],kind=='integration'))
browser_ids = [c['id'] for c in case_rows if c['check']=='revocation-browser']
ingest('check-register','check-revocation-browser',check('revocation-browser','browser',
 [NODE,'node_modules/@playwright/test/cli.js','test','workflow/tests/browser/reviewer-revocation.spec.ts','--grep','|'.join(browser_ids),'--workers=1'],
 common_paths+['src/client/src','src/server/src','workflow/tests/browser','playwright.config.ts'],True))
matrix = {'cases':case_rows,'not_applicable':{}}
ingest('matrix','acceptance-plan',matrix)
print(json.dumps({'assignments':len(assignments),'cases':len(case_rows),'checks':len(groups)+5,'status':'planned; future named tests not executed'},indent=2))
