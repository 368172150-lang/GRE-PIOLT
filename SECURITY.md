# Security and data boundaries

GRE Pilot is an independent learning tool. The local experience uses browser localStorage and Web Locks, with a tab-scoped sessionStorage buffer for unsaved writing; it is not a secure multi-user account store. Supabase mode relies on Auth JWTs, RLS and authenticated guarded RPCs. Public content and private activity are separate.

Keep server/service-role/AI credentials out of VITE_ variables, source control, screenshots and reports. The optional feedback service validates the session with Supabase, checks ownership of a completed essay, reserves a UTC-day quota and accepts only bounded text feedback. It is disabled by default. User essay text is treated as untrusted data, not instructions; feedback is educational, never an official score.

For a suspected issue, do not publish passwords, access tokens, full essays or real student records. Reproduce with disposable accounts and synthetic text, record the affected version and the smallest safe steps, then report privately to the repository maintainer through a channel they provide. No maintainer email or private-report service has been configured in this deliverable.

Run npm audit and the full verification suite when updating dependencies. The current minimatch 11 override addresses the advisory documented in docs/dependency-notes.md; retain it until upstream ranges include a patched release. A passing audit is a point-in-time check, not a guarantee that all vulnerabilities are absent.
