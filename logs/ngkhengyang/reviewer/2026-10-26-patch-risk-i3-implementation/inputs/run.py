"""Trusted run-local CLI environment; never prints connection or provider values."""
import os,pathlib,subprocess,sys
root=pathlib.Path.cwd()
os.environ.update(GIT_CONFIG_COUNT='1',GIT_CONFIG_KEY_0='safe.directory',GIT_CONFIG_VALUE_0=root.as_posix())
os.environ['PATH']=str(root/'.tools/bin')+';C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin;'+os.environ['PATH']
os.environ['PLAYWRIGHT_BROWSERS_PATH']=str(root/'.tools/playwright-browsers')
for line in (root/'.tools/reviewer-test-db.env').read_text().splitlines():
    if '=' in line and not line.startswith('#'):
        k,v=line.split('=',1);os.environ[k]=v.strip().strip('"')
args=sys.argv[1:]
if args and args[0]=='exec':argv=args[1:]
else:argv=[sys.executable,'-B','workflow/reviewer/scripts/workflow.py','--run','logs/ngkhengyang/reviewer/2026-10-26-patch-risk-i3-implementation']+args
raise SystemExit(subprocess.run(argv).returncode)
