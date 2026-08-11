# KWMPF

香港強積金計劃及基金比較網站。第一版正在建立中。

## Development

```bash
bun install --frozen-lockfile
bun run check
```

## Cloudflare staging

Run the interactive setup wizard from a terminal:

```bash
./scripts/setup-cloudflare-staging.sh
```

It creates no local credential file. The three deployment values are written directly to the protected GitHub `staging` environment. See `docs/deployment.md` for the resource names and verification contract.
