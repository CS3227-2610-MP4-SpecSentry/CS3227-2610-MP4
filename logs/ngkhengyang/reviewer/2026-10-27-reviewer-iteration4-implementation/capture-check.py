"""Bounded, credential-redacted output for scoped implementation check diagnostics."""
import os
import re
import subprocess
import sys
from datetime import datetime,timezone
from pathlib import Path
if hasattr(sys.stdout, 'reconfigure'):
 sys.stdout.reconfigure(encoding='utf-8',errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
 sys.stderr.reconfigure(encoding='utf-8',errors='replace')
name=sys.argv[1]
if not re.fullmatch(r'[a-z0-9-]+',name):raise SystemExit('Unsafe evidence name')
argv=sys.argv[2:]
timeout=165
if argv[:1]==['--timeout']:
 timeout=int(argv[1]);argv=argv[2:]
 if not 1 <= timeout <= 3500:raise SystemExit('Invalid bounded check timeout')
root=Path(__file__).resolve().parents[4]
run=Path(__file__).resolve().parent
result=subprocess.run(argv,cwd=root,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=timeout)
output=result.stdout+'\n'+result.stderr
for variable in ('TEST_DATABASE_URL','DIRECT_DATABASE_URL','DATABASE_URL','SESSION_SECRET'):
 value=os.environ.get(variable)
 if value:output=output.replace(value,'[redacted configuration]')
output=re.sub(r'postgres(?:ql)?://[^\s]+','[redacted database URL]',output)
stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
path=run/'reports'/(name+'-'+stamp+'.txt')
path.write_text(output[:60000],encoding='utf-8')
print(output[:60000])
print('Safe captured output: '+str(path.relative_to(root)))
raise SystemExit(result.returncode if len(output)<=60000 else 1)
