# Retired host declaration

At source `c6112e8`, `svelte/legacy/host.d.ts` contained only three transitional comments and `export {}`. It declared no API or global augmentation, and its JavaScript implementation was already absent. This was an empty declaration in behavior, not literally a zero-byte file.

The read-only reference check returned no matches:

```sh
rg -n -F -e 'legacy/host' -e 'host.d.ts' svelte src shared collab service-worker scripts package.json tsconfig*.json
```

The unused declaration is removed separately from the inventory tool/ownership manifest. No runtime source, source-level import or application behavior changes. Root's later source/UI gates will cover integration; no new test or runtime acceptance is claimed for this type-only cleanup. Frozen inventory/baseline records remain unchanged.
