# Arc transition
- [ ] Integrate OpenPay Arc partner API securely with network discovery, balance reads, payment status, and wallet-approved transfers.
- [x] Add real-network Arc App Kit wallet connection, balance, send, and bridge entry point.
- [x] Implement verified wallet linking to existing accounts without changing balances or profiles.
- [x] Add Arc wallet sign-in with admin visibility controls and preserved legacy account access.
- [ ] Verify wallet linking/sign-in and transfers with a real wallet approval; blocked by unavailable wallet signer and account unlock.
- [ ] Retire remaining Pi-specific flows and update remaining product surfaces after replacement wallet access and live transfers pass verification; blocked by the migration verification gate above. Do not strand existing users or relabel Pi holdings as USDC.