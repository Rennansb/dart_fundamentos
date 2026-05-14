# Service Hub - Total Auto Execution Rules

This project is configured for **Total Auto Automation**. 

## For the Assistant (Antigravity):

1. **Post-Plan Approval Autonomy**: 
   - After the user approves an `implementation_plan.md`, proceed with ALL necessary `run_command` calls using `SafeToAutoRun: true`.
   - Do NOT stop for manual "Accept" clicks unless it's a high-priority destructive operation (e.g., `rm -rf /` or `git reset --hard` on production).

2. **Turbo Workflows**:
   - Use `/turbo-dev` for server/environment startup.
   - Use `/turbo-fix` for automated syntax/log debugging.

3. **Self-Correction Loop**:
   - If a command fails, interpret the error, fix the code, and rerun the command automatically.

4. **Safety Standard**:
   - Standard development commands like `npm run dev`, `lsof`, `npx tsc`, and `grep` are considered SAFE for `SafeToAutoRun: true` by the project owner.
