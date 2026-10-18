<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep authentication SDK panels in lazy, client-only provider boundaries so restoring sign-in options cannot introduce SSR startup crashes.
- Bundle all npm dependencies for the Worker server; never configure SSR externals because production has no npm runtime resolution.
- Stub browser-only packages with load-time side effects (e.g. ConnectKit's `@aave/account`) for server environments via a vite resolveId plugin; Workers forbid timers in global scope and every page would 500.
- Use /auth as the shared sign-in/signup surface with an Outlet for OAuth callbacks and redirect /authpi there; this preserves existing callback and bookmarked URLs.
- Provision Arc wallet accounts only after consuming a verified server-stored signup challenge, reusing existing wallet links and profile triggers without writing balances; this prevents duplicate identities and free credit.
- The public sign-in list reads the shared auth-method flags and refuses to display methods when that read fails, so admin maintenance switches are not bypassed by network errors.
- Arc integration uses App Kit only in dynamically imported browser actions; wallet signatures use one-time server-stored challenges and link existing account IDs, never convert Pi or ledger balances into on-chain USDC.
- OpenPay Arc partner calls stay in server helpers behind authenticated functions; transfers require a linked wallet, verified mainnet USDC calldata and browser-side simulation/signing so partner credentials never grant custody or ledger credit.
