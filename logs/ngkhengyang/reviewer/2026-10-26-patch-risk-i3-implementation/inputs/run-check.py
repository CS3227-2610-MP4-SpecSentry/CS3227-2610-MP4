"""Capture bounded synthetic test diagnostics, redacting any database URL."""
import json,pathlib,re,subprocess,sys
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
p=pathlib.Path('logs/ngkhengyang/reviewer/2026-10-26-patch-risk-i3-implementation')
name=sys.argv[1]
check=json.loads((p/'inputs'/('check-'+name+'.json')).read_text(encoding='utf-8'))
r=subprocess.run(check['argv'],capture_output=True,text=True,encoding='utf-8',errors='replace')
safe=re.sub(r'postgres(?:ql)?://[^\s"\x27]+','[redacted-database-url]',r.stdout+'\n'+r.stderr)
(p/'reports').mkdir(exist_ok=True)
(p/'reports'/(name+'-latest.txt')).write_text(safe[-60000:],encoding='utf-8')
print(safe[-60000:])
raise SystemExit(r.returncode)
