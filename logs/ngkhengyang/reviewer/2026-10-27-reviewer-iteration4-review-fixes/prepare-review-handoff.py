import json,subprocess,sys,os,hashlib
from pathlib import Path
root=Path.cwd();run=Path(__file__).resolve().parent
old=root/'logs/ngkhengyang/reviewer/2026-10-27-reviewer-iteration4-implementation'
cli=[sys.executable,'-B','workflow/reviewer/scripts/workflow.py','--run',str(run.relative_to(root))]
env=os.environ.copy();env.update(GIT_CONFIG_COUNT='1',GIT_CONFIG_KEY_0='safe.directory',GIT_CONFIG_VALUE_0=root.as_posix())
def call(args):
 p=subprocess.run(cli+args,capture_output=True,text=True,env=env,encoding='utf-8',errors='replace')
 if p.returncode:raise RuntimeError(p.stdout+p.stderr)
 return json.loads(p.stdout)
state=json.loads((old/'state.json').read_text())
paths=sorted(set(state['verification_checks']['integration-browser-default']['paths'])|set(state['verification_checks']['integration-build']['paths']))
docs=['docs/UserGuide.md','docs/DeveloperGuide.md','docs/Architecture.md','workflow/TRACEABILITY.md']
paths=[p for p in paths if (root/p).exists()]
for sid,scope in [('integrated-application-review1',paths),('integrated-docs-review1',docs)]:
 args=['snapshot','--id',sid,'--base','HEAD']
 for p in scope:args+=['--path',p]
 call(args)
changed=subprocess.check_output(['git','diff','--name-only'],env=env,text=True).splitlines()+subprocess.check_output(['git','ls-files','--others','--exclude-standard'],env=env,text=True).splitlines()
changed=sorted({p for p in changed if not p.startswith('logs/')})
manifest={'base':'9556b72b5cce9da8df0b40887c8ba816cccdaaf8','files':{p:hashlib.sha256((root/p).read_bytes()).hexdigest() if (root/p).is_file() else None for p in changed}}
(run/'reports/initial-reviewed-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
record=call(['start','--agent','independent-reviewer','--invocation','review-round1','--stage','review','--model','gpt-6-sol','--effort','high'])
refs=['workflow/reviewer/agents/REVIEWER.md','workflow/reviewer/IMPLEMENTATION.md','workflow/specs/ROLE-REVIEWER.md','workflow/specs/ROLE-MAINTAINER.md','workflow/specs/INTEGRATION-SPEC.md',
 'logs/ngkhengyang/reviewer/2026-10-26-reviewer-iteration4/brief.md','logs/ngkhengyang/reviewer/2026-10-26-reviewer-iteration4/reports/security-design.md',str(run.relative_to(root)/'reports/initial-reviewed-manifest.json'),str(run.relative_to(root)/'inputs/matrix-targeted-checks.json'),str(run.relative_to(root)/'reports/replacement-ownership-plan.json')]
packet={'identity':'Main to independent-reviewer: iteration4 initial implementation handoff. User authorized full review/fix/revalidation then consolidation, superseding first-round stop. State is PARTIAL: integration wiring implemented; real browser verification blocked.',
 'requirements':'Review REQ-REV-016 plus004/005/006 and supporting release/security contracts against approved design and49 cases. Explicit revoke preserves original approval; candidate blocker/notice/publish locks; manual UI/retry/history. No broad Maintainer UI, deployment or live AI. Apply review-changes-to-specs and review-security skills. Requirement authority outranks implementation summaries.',
 'permissions':'Production/tests/docs READ ONLY. No source edits, new agents, migrations, reset, secrets or broad repeated checks. Send batched findings directly to NEW fixer when assigned, and root. Root records findings/intervals. Fixer alone owns reviewed production/test set under explicit follow-on plan; coordinator owns logs/docs. You are independent of all code authors. Request targeted leased checks from fixer/root only when discriminating.',
 'state':'Base9556b72b5cce9da8df0b40887c8ba816cccdaaf8, uncommitted changes and untracked sources covered by manifest and application/docs snapshots. Original workers foundation/reviewer/release/UI completed feature scopes; integrator wired app.module, manage-account CLI and Playwright fixture. Original owner fixed invalid fixture diff, nested result ordering, lint and exact Decision label. Confirm final manifest identity before reviewing. Integration report will supply trace details; current browser times out30s after real UI approval. Original owners frozen.',
 'verification':'Recorded original run: build/types/lint pass; units155, PostgreSQL171/171 pass before final browser-only selector edit; backend source unchanged thereafter. Browser initially submit422 invalid fixture, then ambiguous Decision selector, then restored disposablePG after ECONNREFUSED, now timeout. Regressions/default not yet reached. Source scopes were overly broad; do not treat hash invalidation as a product failure or imply unexecuted checks passed. Independently assess49case semantics, test necessity/duplication, real PG blocking assertions, rollback assertions, UI uncertain-retry/accessibility coverage and all changed docs. Test count is not assurance. Return criterion-level evidence/status, findings with requirement/severity/blocking/owner/path:line/repro/expected fix validation. New fix owner is fixer.',
 'risks':'Confirmed browser timeout is an open blocker requiring diagnosis, not a verified app defect yet. Inspect production authorization before reads/replay, session/CSRF and account-session-candidate-proposal locks, version gates, immutable approval/publication, transactional notice/audit. Urgent blocker immediately; batch routine findings. After fix inspect actual diff and regressions before closure. After two failed cycles root must reassess. Human teammate review remains separate.',
 'resources':'Selected gpt-6-sol/high because cross-role transaction, locking, privacy and immutable-publication invariants need careful review. Focused fresh context; no inherited conversation. Resource record '+record['record_id']+'. Exact stage tokens unavailable; per-thread cumulative samples collected separately. No numeric budget imposed.',
 'references':refs,'snapshot_id':'integrated-application-review1','resource_record':record['record_id']}
p=run/'inputs/11-main-to-reviewer.json';p.write_text(json.dumps(packet,indent=2)+'\n')
call(['handoff','create','--id','11-main-to-reviewer','--input',str(p.relative_to(root))])
print(json.dumps({'review_record':record['record_id'],'handoff':str(run.relative_to(root)/'handoffs/11-main-to-reviewer.md'),'changed_files':len(changed)}))
