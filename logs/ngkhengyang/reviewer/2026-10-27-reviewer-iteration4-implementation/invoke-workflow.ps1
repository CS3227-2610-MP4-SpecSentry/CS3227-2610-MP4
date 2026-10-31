param([Parameter(ValueFromRemainingArguments=$true)][string[]]$WorkflowArguments)
$ErrorActionPreference='Stop'
$taskRepo='C:/Users/User/Documents/NUS/CS3227/CS3227-2610-MP4'
Set-Location -LiteralPath $taskRepo
$env:GIT_CONFIG_COUNT='1'
$env:GIT_CONFIG_KEY_0='safe.directory'
$env:GIT_CONFIG_VALUE_0=$taskRepo
foreach($taskLine in Get-Content -LiteralPath '.tools/reviewer-test-db.env') {
  if($taskLine -match '^TEST_DATABASE_URL=(.+)$') {
    $env:TEST_DATABASE_URL=$Matches[1].Trim().Trim('"').Trim("'")
  }
}
if(-not $env:TEST_DATABASE_URL) { throw 'Explicit disposable test URL is required.' }
$taskTarget=[Uri]$env:TEST_DATABASE_URL
if($taskTarget.Scheme -notin @('postgres','postgresql') -or $taskTarget.Host -notin @('127.0.0.1','localhost') -or $taskTarget.AbsolutePath -ne '/specsentry_reviewer_intake_test') {
  throw 'Test target does not match the approved loopback disposable database.'
}
$env:DIRECT_DATABASE_URL=$env:TEST_DATABASE_URL
$env:PLAYWRIGHT_BROWSERS_PATH=Join-Path $taskRepo '.tools/playwright-browsers'
$env:PATH=(Join-Path $taskRepo '.tools/bin')+';C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;'+$env:PATH
& 'C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -B workflow/reviewer/scripts/workflow.py --run logs/ngkhengyang/reviewer/2026-10-27-reviewer-iteration4-implementation @WorkflowArguments
exit $LASTEXITCODE
