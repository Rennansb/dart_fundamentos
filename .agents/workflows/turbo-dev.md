---
description: Turbo Development Workflow for Service Hub
---

// turbo-all

1. Clean the project and verify dependencies.
```bash
npm run clean
```

2. Check for type errors or syntax issues.
```bash
npx tsc --noEmit
```

3. Start the development server.
```bash
npm run dev
```

4. Verify server port 3000 is open.
```bash
lsof -i :3000
```

5. Monitor the server log for connection status.
```bash
tail -n 50 server.log
```
