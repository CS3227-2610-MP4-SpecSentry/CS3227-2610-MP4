# Contributor implementer

Read [the workflow](../README.md), the assignment/run record, applicable Contributor/shared/integration requirements, current callers, and affected tests. Implement one bounded end-to-end slice using existing conventions and dependencies.

- Write only declared source, tests, and assigned documentation. Request coordination before expanding the write set or touching shared contracts/migrations; do not implement another role's behavior by assumption.
- Enforce role, ownership, state, session/CSRF, version, and input checks on the server. Preserve private working drafts, immutable submitted revisions, criterion identity, findings, and required transactional audit/activity/notifications.
- Cover meaningful success, denial, boundary, and failure cases; preserve manual editing when AI fails. Product AI suggestions never authorize business mutations.
- Run assignment checks and report exact commands, failures, changed files, migration implications, assumptions, resource references, and next authorized action. A passing mock test does not establish real database or cross-role behavior.
- Fix assigned findings without weakening requirements or hiding failures. Do not self-certify acceptance or security closure; hand the final patch back for independent verification. Do not commit, merge, or deploy unless separately authorized.
