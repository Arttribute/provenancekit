```
npm install
npm run dev
```

```
open http://localhost:3000
```

## High-throughput agent trajectories

`POST /v1/actions/batch` accepts `{ bundle, onchain?: false }`, where `bundle`
is a strict EAA v2 provenance bundle. The endpoint de-duplicates retries,
parallelizes writes within dependency stages, and returns a deterministic bundle
hash. If `onchain` is explicitly true, one aggregate bundle digest is submitted;
individual trajectory events are not sent as separate transactions.

On-chain recording is opt-in for both this endpoint and `/activity`. Configuring
a blockchain provider no longer anchors every activity automatically.
