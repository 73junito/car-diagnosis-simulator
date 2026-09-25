# Exam domain readiness

The dedicated `exam.autolearnpro.com` Worker serves an informational page. It does not serve questions, accept purchases, issue credentials, or create exam attempts. Unknown paths return 404.

The page identifies the verified KBOR Automotive Technology program (CIP 47.0604) and its Electrical 1 common course. The displayed charging-system competency and learning objectives are AutoLearnPro-authored drafts. They are not KBOR quotations or approved question-level mappings.

Production deployment uses `npx wrangler deploy --config wrangler.exam.jsonc`. The separate Worker keeps exam routing isolated from the public and training applications. Certification infrastructure remains deferred under `docs/PAYMENT_ENTITLEMENT_CONTRACT.md`.
