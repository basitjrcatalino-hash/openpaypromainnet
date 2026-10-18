import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveArcAccount } from "./arc-account.server";

const address = "0x946b7a0f7f8e883ef56d92c9ce8c5c48458b79e2";
function fixture(link: { user_id: string } | null) {
  const writes: Array<{ table: string; value: unknown }> = [];
  const created: unknown[] = [];
  const client = {
    from: (table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: link, error: null }) }) }),
      insert: async (value: unknown) => { writes.push({ table, value }); return { error: null }; },
    }),
    auth: { admin: { createUser: async (value: unknown) => { created.push(value); return { data: { user: { id: "new-account" } }, error: null }; } } },
  } as unknown as SupabaseClient;
  return { client, writes, created };
}
test("wallet sign-in preserves the existing linked account", async () => {
  const f = fixture({ user_id: "existing-account" });
  assert.equal(await resolveArcAccount(f.client, address, true), "existing-account");
  assert.equal(f.created.length, 0);
  assert.equal(f.writes.length, 0);
});
test("unlinked wallet cannot create an account without explicit signup", async () => {
  const f = fixture(null);
  await assert.rejects(resolveArcAccount(f.client, address, false), /Create an account/);
  assert.equal(f.created.length, 0);
});
test("wallet signup links its new account without granting free balances", async () => {
  const f = fixture(null);
  assert.equal(await resolveArcAccount(f.client, address, true), "new-account");
  assert.equal(f.created.length, 1);
  assert.deepEqual(f.writes, [{ table: "arc_wallet_links", value: { address, user_id: "new-account" } }]);
});