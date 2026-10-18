# Arc transition
- [ ] Move sign-in to /auth with an /authpi redirect and reuse the Arc wallet picker for verified wallet signup/sign-in.
- [x] Integrate OpenPay Arc partner API securely with mainnet network discovery, live USDC/savings reads, and linked-wallet unsigned transfer preparation.
- [x] Add real-network Arc App Kit wallet connection, balance, send, and bridge entry point.
- [x] Implement verified wallet linking to existing accounts without changing balances or profiles.
- [x] Add Arc wallet sign-in with admin visibility controls and preserved legacy account access.
- [ ] Verify wallet linking/sign-in and transfers with a real wallet approval; blocked by unavailable wallet signer. OpenPay Arc live reads and unsigned transfer data are verified; actual submission still requires wallet approval.
- [ ] Retire remaining Pi-specific flows and update remaining product surfaces after replacement wallet access and live transfers pass verification; blocked by the migration verification gate above. Do not strand existing users or relabel Pi holdings as USDC.