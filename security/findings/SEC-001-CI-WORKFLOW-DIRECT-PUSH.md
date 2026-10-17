# SEC-001 — Manually dispatched workflow can write directly to main

**Status:** FIXED—AWAITING RETEST (candidate Verify and Android APK CI pass; independent security retest pending)  
**Severity:** MEDIUM  
**Confidence:** CONFIRMED by source and repository configuration evidence  
**First worker:** 001  
**Baseline commit:** `f812973aca63ca7401ef1b3e8db204193bcc3444`  
**Product issue:** [#2](https://github.com/hkadam888555888/androidapp/issues/2)

## Protected asset and security objective

Protect the integrity of the app's default-branch source and ensure code changes are reviewable before they become part of the release candidate.

## Evidence observed

On baseline `main`, `.github/workflows/repair-build.yml`:
- granted `contents: write`;
- ran source replacement commands, staged files and committed changes;
- contained `git push origin HEAD:main` in the workflow's automated commit step.

The GitHub branch listing reported `main` as `protected: false`. The current connector could not read the detailed branch-protection endpoint, but the branch listing is direct evidence that GitHub did not report this branch as protected.

The workflow also expected exact old source snippets that no longer matched the current files. A manual dispatch could therefore fail at the repair assertions before it reaches the dispatch step. This is a separate reliability defect, not the security impact.

## Safe reproduction / confirmation

This finding was confirmed by reading the workflow and branch metadata. No workflow was executed, no source change was pushed to `main`, and no external actor or production target was tested. Manual workflow dispatch requires repository write access; evidence does **not** show unauthenticated remote execution.

## Impact

The workflow encoded an automated route for changing the default branch without a pull request or review of the generated diff. On an unprotected branch, this bypasses the project's intended review gate for changes made by the workflow. A compromised write-capable account or later modification of the repair logic could abuse the same path. Severity is MEDIUM because the workflow is manually dispatched by a repository writer and the defect is a change-control path, not a demonstrated unauthenticated exploit.

## Remediation on the proposed branch

1. Replace the repair-and-push job with a dispatcher that has only `actions: write`.
2. Remove checkout, source modification, staging, commit, and direct-push commands from the dispatcher.
3. Keep source changes on dedicated non-default branches and review them through a pull request.
4. Add a regression guard to `scripts/source-audit.mjs` that requires the dispatcher permission, forbids `contents: write`, `git commit`, `git push`, and source-repair steps, and ensures both verification workflows are dispatched.
5. Clear the existing lint gate blockers so the pull request can reach unit tests and build checks. Those lint cleanups are ancillary quality fixes, not separate security findings.

## Regression verification

- **Test path:** `scripts/source-audit.mjs`
- **Command:** `npm run audit:source`
- **Expected:** PASS only if the dispatch workflow retains its minimal permission and no direct-write/commit/push path.
- **Baseline evidence:** main's run [37968141061](https://github.com/hkadam888555888/androidapp/actions/runs/37968141061) passed the prior source audit but failed lint; tests/build were skipped.
- **Candidate Verify CI:** PASS at `c68cd32ae10d5566e0ae56ee3764deed4856fc41`: 17 source-audit checks passed; lint had 0 errors / 1 warning; 96 tests passed across 23 files; production TypeScript/web build and bundle-size checks passed. [Run #39012754842](https://github.com/hkadam888555888/androidapp/actions/runs/39012754842).
- **Android APK CI:** PASS at the same candidate SHA. The runner pinned npm to `11.6.0` to avoid the observed npm 10.9.9 Arborist `edgesOut` crash, then installed Capacitor, generated/synced the Android project, assembled the debug APK and uploaded the artifact. [Run #39012754835](https://github.com/hkadam888555888/androidapp/actions/runs/39012754835). Artifact `my-adaptive-routine-debug-apk`, ID `12093199321`, size 3,958,798 bytes, expires 2026-10-31. This is a debug build, not a signed production release or physical-device verification.
- **Independent retest:** pending Worker 098; the source-based CI regression guard passed, but no separate security actor/session has independently attempted the bypass yet.
- **Independent retest:** worker 098 is assigned to inspect the merged candidate only after human approval, retry the direct-write paths, vary workflow permissions/commands, and re-run the regression check. Do not mark RETEST PASSED before that evidence exists.

## Residual risk / owner action

This patch only removes the direct-to-main path in this workflow. It does not protect the branch from another workflow or any other write-capable actor. Enable required pull requests/reviews and appropriate status checks for `main` in GitHub settings as a separate owner-controlled action. The security branch must remain unmerged until reviewed. No automatic merge, release, or deployment is allowed. Although both Verify and Android APK CI pass, overall release readiness remains NOT GRADED because broad security coverage, Playwright end-to-end/device evidence, Worker 098's independent retest, branch-protection settings and explicit human approval are still missing.
