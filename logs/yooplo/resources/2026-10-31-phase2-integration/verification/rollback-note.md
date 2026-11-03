# Historical local rollback snapshot

Before Phase2 integration,57 existing files, original status/index and64 patch
targets were recorded under local ignored
`tmp/phase2-integration-rollback-20261031-174917`. Those bytes and its README/script
remain local; they are not application assets and are deliberately not published.

The script defaults to a dry run, validates every target before restoring, refuses
unexpected later edits, and never changes Git refs/index. The historical dry run
planned64 safe operations; actual rollback was not executed. Phase3 subsequently
changed some targets, so do not treat that old rollback as applicable to current
work without its own refusal/precondition checks.

Published [preservation snapshot](preservation-manifest.json) and
[completion status](git-status-at-completion.txt) preserve safe verification
metadata without including source backups, environment values or generated files.
