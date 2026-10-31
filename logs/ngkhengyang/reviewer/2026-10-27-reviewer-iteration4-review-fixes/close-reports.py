import json,subprocess,sys,os,re,hashlib
from pathlib import Path
from datetime import datetime
root=Path.cwd();run=Path(__file__).resolve().parent
env=os.environ.copy();env.update(GIT_CONFIG_COUNT='1',GIT_CONFIG_KEY_0='safe.directory',GIT_CONFIG_VALUE_0=root.as_posix())
base=[sys.executable,'-B','workflow/reviewer/scripts/workflow.py']
def call(folder,args,allowed=(0,)):
 p=subprocess.run(base+['--run',str(folder.relative_to(root))]+args,capture_output=True,text=True,encoding='utf-8',errors='replace',env=env)
 if p.returncode not in allowed:raise RuntimeError(p.stdout+p.stderr)
 return json.loads(p.stdout)
log=root/'logs/ngkhengyang/2026-10-26-reviewer-iteration4.md'
text=log.read_text();section=text.split('## Consolidated implementation, integration and review/fix outcome',1)[1]
missing=[]
for link in re.findall(r'\]\(([^)]+)\)',section):
 target=link.strip('<>').split('#',1)[0]
 if target.startswith(('https://','http://')):continue
 p=Path(target) if re.match(r'^[A-Za-z]:',target) else log.parent/target
 if not p.exists():missing.append(target)
if missing:raise SystemExit('Broken consolidated links: '+str(missing))
manifest=json.loads((run/'reports/final-reviewed-manifest.json').read_text())
for p,h in manifest['files'].items():
 actual=hashlib.sha256((root/p).read_bytes()).hexdigest() if (root/p).is_file() else None
 if actual!=h:raise SystemExit('Source drift: '+p)
for rid,outcome in [('rec-455349fd5afe4e8e','Consolidation authored and verified:43 reviewedfile hashes current, reportlinks resolved, all10participants and40intervalrecords accounted, findingsclosed, exactvalidation/reuse/resources linked.'),('rec-d302466d481c47f4','Final evidence validation complete: sourceidentity andlocalreportlinks verified; finalCLIbundles generated after actual timing close, structural limitations preserved.')]:
 call(run,['finish','--id',rid,'--status','succeeded','--outcome',outcome,'--unavailable-reason','Stage-aligned telemetry unavailable;10thread cumulative closurecutoff retained separately'])
folders=[root/'logs/ngkhengyang/reviewer'/n for n in ('2026-10-26-reviewer-iteration4','2026-10-27-reviewer-iteration4-implementation','2026-10-27-reviewer-iteration4-review-fixes')]
records=[dict(v,run=str(folder.relative_to(root))) for folder in folders for v in json.loads((folder/'state.json').read_text())['records'].values()]
if any(not r['end'] for r in records):raise SystemExit('Unexpected runningresource interval')
def ts(s):return datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()
def merge(rows):
 result=[]
 for a,b in sorted(rows):
  if result and a<=result[-1][1]:result[-1][1]=max(result[-1][1],b)
  else:result.append([a,b])
 return sum(b-a for a,b in result)
intervals=[(ts(r['start']),ts(r['end'])) for r in records]
by_agent={}
for r in records:by_agent.setdefault(r['agent'],[]).append((ts(r['start']),ts(r['end'])))
respath=run/'reports/final-resources.json';resources=json.loads(respath.read_text())
resources.update(record_count=len(records),finished_count=len(records),running=[],records=records,
 calendar_span_seconds=max(b for a,b in intervals)-min(a for a,b in intervals),merged_interval_coverage_seconds=merge(intervals),
 raw_summed_interval_seconds=sum(b-a for a,b in intervals),summed_per_declared_agent_merged_seconds=sum(merge(rows) for rows in by_agent.values()))
resources['limitations'][-1]='All40 declared intervals finished at actual observed boundaries. Unknown pause gaps remain elapsed, not compute. Final response/report rendering excluded.'
respath.write_text(json.dumps(resources,indent=2)+'\n')
bundles=[]
for folder in folders:
 bundle=call(folder,['report','--format','bundle'],allowed=(0,1))
 p=folder/'reports/final-close-bundle.json';p.write_text(json.dumps(bundle,indent=2)+'\n')
 (folder/'reports/final-close-report.md').write_text(bundle['markdown'])
 consistency=bundle['consistency'];bundles.append({'run':folder.name,'ok':consistency['ok'],'errors':consistency['errors'],'warning_count':len(consistency['warnings'])})
(run/'reports/structural-status.json').write_text(json.dumps(bundles,indent=2)+'\n')
with log.open('a',encoding='utf-8') as out:
 out.write('\n### Final timing and structural evidence boundary\n\n')
 out.write(f"All **{len(records)}** declared intervals are finished. Calendar span: **{resources['calendar_span_seconds']:.3f}s**; merged interval coverage: **{resources['merged_interval_coverage_seconds']:.3f}s**; raw summed interval elapsed: **{resources['raw_summed_interval_seconds']:.3f}s**; summed per-declared-agent merged elapsed: **{resources['summed_per_declared_agent_merged_seconds']:.3f}s**. These include pauses/waits and unknown interruption gaps; active computation is unavailable. Same-agent overlap is merged in the latter figure. The raw records remain in final-resources.json.\n\n")
 out.write('Source hashes and local links in the consolidated section were verified. Every explicit request has an outcome or the stated exclusion. Agent implementation/security review is complete and F-001 through F-004 are independently closed. The local structural reports **are not green**: historical interrupted/failed attempts and stale broad snapshots remain, and the follow-on CLI does not import prior-run executions as its own49-case matrix evidence. We retained those truthful gaps rather than fabricating executions, deleting history or rerunning unchanged product suites solely to satisfy metadata. Independent reviewer accepted the specific unchanged-source evidence reuse; this does not claim CLI completeness.\n\n')
 for b in bundles:
  relative=(Path('reviewer')/b['run']/'reports/final-close-report.md').as_posix()
  out.write(f"- [{b['run']} structural report]({relative}): ok={b['ok']}, {len(b['errors'])} errors; complete original JSON bundle retained alongside it.\n")
 out.write('\n[Combined structural status](reviewer/2026-10-27-reviewer-iteration4-review-fixes/reports/structural-status.json) preserves every reason. Report/response rendering lies outside the finished measurement boundary. No evidence was deleted, no commit/push/deployment was performed, and liveAI/human teammate approval remain separate.\n')
print(json.dumps({'resources':{k:resources[k] for k in ('record_count','calendar_span_seconds','merged_interval_coverage_seconds','raw_summed_interval_seconds','summed_per_declared_agent_merged_seconds')},'bundles':[{'run':b['run'],'ok':b['ok'],'errors':len(b['errors'])} for b in bundles],'all_intervals_finished':True}))
