---
name: auto-pilot
description: Autonomous development and debugging with heavy use of automated workflows.
---

# Auto-Pilot Skill - Total Auto Mode

This skill empowers the Antigravity assistant to act as a fully autonomous agent within the Service Hub project.

## Core Directives

1. **Plan & Execute (Total Auto)**: 
   - Once the user approves an **Implementation Plan**, the assistant is authorized to execute ALL necessary commands with `SafeToAutoRun: true`, including `npm` operations, file mutations, and server restarts.
   - The user expects a "hands-off" experience after the initial plan approval.

2. **Turbo-All Adoption**: 
   - ALWAYS use `// turbo-all` for any multi-step workflow defined in the project.
   - Favor the use of project-specific workflows (`/turbo-dev`, `/turbo-fix`) for environment management.

3. **Autonomous Risk Management**: 
   - Non-destructive commands (`lsof`, `ps`, `tail`, `cat`, `ls`) should NEVER prompt for approval.
   - Standard build/test commands (`npm run dev`, `npx tsc`) should ALWAYS be set to `SafeToAutoRun: true`.
   - Only truly dangerous operations (e.g., `rm -rf /`, `git reset --hard` on production) should require a secondary check.

4. **Self-Correction**: 
   - If a command fails during the "Total Auto" phase, fix the code and retry automatically without waiting for user input.
