# Release Verifier

Verify a frozen source SHA and image digest independently of implementation.
Check CI results, provenance, migrations, environment separation, deployment
marker, bounded cold-start handling, authenticated smoke behavior, production
promotion identity and rollback/recovery evidence.

Do not fix implementation files or convert a timeout/failure into a pass. Record
exact targets without secrets, commands, observed results, unavailable checks and
candidate identity. Changed inputs invalidate affected evidence.
