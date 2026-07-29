import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Resolve an auth user by email. Prefer generateLink (O(1)), then paginate listUsers.
 * Bare listUsers() only returns the first page (~50) and breaks Pi/OpenPay re-login.
 */
export async function findAuthUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<User | null> {
  const needle = email.trim().toLowerCase();
  if (!needle) return null;

  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: needle,
    });
    if (!error && data?.user) return data.user;
  } catch {
    /* fall through to listUsers */
  }

  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    const found = users.find((u) => (u.email ?? "").toLowerCase() === needle);
    if (found) return found;
    if (users.length < 1000) break;
  }

  return null;
}

export async function provisionPasswordUser(
  admin: SupabaseClient,
  opts: {
    email: string;
    password: string;
    metadata: Record<string, unknown>;
  },
): Promise<User> {
  const email = opts.email.trim().toLowerCase();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: opts.password,
    email_confirm: true,
    user_metadata: opts.metadata,
  });

  if (createErr && !/registered|exists|duplicate|already/i.test(createErr.message)) {
    throw new Error(createErr.message);
  }

  if (created?.user) return created.user;

  const existing = await findAuthUserByEmail(admin, email);
  if (!existing) {
    throw new Error(`Failed to provision user for ${email}`);
  }

  const { data: updated, error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
    password: opts.password,
    email_confirm: true,
    user_metadata: {
      ...existing.user_metadata,
      ...opts.metadata,
      display_name:
        (existing.user_metadata as { display_name?: string } | undefined)?.display_name ??
        opts.metadata.display_name,
    },
  });
  if (updErr) throw new Error(updErr.message);
  return updated.user ?? existing;
}
