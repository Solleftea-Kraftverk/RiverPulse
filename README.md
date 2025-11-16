# River Pulse
Frontend repo for River Pulse. It runs on a cloudflare database and backend

Databasen är https://river-pulse-data-fetcher.philip-strassenbergen.workers.dev/data under Cloudflare

## Steps for basic process to relase changes in frontend:
- Open VSCode, go to source ctrl
- Sync or fetch and pull
- decide what to do in linegraph.js or index.html
- Ctrl S
- Back to src ctrl
- Stage/add the changes I want to add (if not all)
- If all then just do Commit. But first do commit msg (AI symbol)
- Press blue button (Synch) as long as it is blue button
- If you need to regret latest commit: Open VS Code Terminal.
    - git reset --hard HEAD~1
    - git push --force
