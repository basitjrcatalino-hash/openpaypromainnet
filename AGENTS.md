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
- The public sign-in list reads the shared auth-method flags and refuses to display methods when that read fails, so admin maintenance switches are not bypassed by network errors.
- Arc integration uses App Kit only in dynamically imported browser actions; wallet signatures use one-time server-stored challenges and link existing account IDs, never convert Pi or ledger balances into on-chain USDC.
- OpenPay Arc partner calls stay in server helpers behind authenticated functions; transfers require a linked wallet, verified mainnet USDC calldata and browser-side simulation/signing so partner credentials never grant custody or ledger credit.
