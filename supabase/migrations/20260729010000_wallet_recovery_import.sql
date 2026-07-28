-- OpenPay Pro wallet recovery: deterministic restore by phrase hash.
-- Import restores the exact ledger row (address, balances, holdings) via recovery_hash.

ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS recovery_hash text;

ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS removed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS wallets_recovery_hash_uidx
  ON public.wallets (recovery_hash)
  WHERE recovery_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS wallets_user_active_idx
  ON public.wallets (user_id)
  WHERE removed_at IS NULL;

COMMENT ON COLUMN public.wallets.recovery_hash IS
  'SHA-256 hex of normalized 12/24-word recovery phrase (never store plaintext).';
COMMENT ON COLUMN public.wallets.removed_at IS
  'Soft-remove timestamp. Import by recovery phrase can restore the same ledger.';

-- Keep recovery_hash writeable on insert/update for owners, but hide from SELECT.
REVOKE SELECT (recovery_hash) ON public.wallets FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.import_openpay_wallet(
  p_recovery_hash text,
  p_address text,
  p_name text DEFAULT 'Imported wallet'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  wal public.wallets%ROWTYPE;
  addr text := lower(trim(p_address));
  rh text := lower(trim(p_recovery_hash));
  nm text := nullif(trim(coalesce(p_name, '')), '');
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF rh IS NULL OR length(rh) < 32 THEN
    RAISE EXCEPTION 'Invalid recovery hash';
  END IF;
  IF addr IS NULL OR length(addr) < 10 THEN
    RAISE EXCEPTION 'Invalid wallet address';
  END IF;

  -- Exact restore: knowledge of recovery phrase (hash) proves ownership.
  -- Never claim by address alone.
  SELECT * INTO wal
  FROM public.wallets
  WHERE recovery_hash = rh
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.wallets
    SET is_active = false
    WHERE user_id = uid AND id <> wal.id AND removed_at IS NULL;

    UPDATE public.wallets
    SET
      user_id = uid,
      name = coalesce(nm, name),
      is_active = true,
      removed_at = NULL
    WHERE id = wal.id
    RETURNING * INTO wal;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.wallets
      WHERE lower(address) = addr AND removed_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Wallet address already exists — use the original recovery phrase for that wallet';
    END IF;

    UPDATE public.wallets
    SET is_active = false
    WHERE user_id = uid AND removed_at IS NULL;

    INSERT INTO public.wallets (
      user_id, name, address, recovery_hash, is_active, ousd_balance, pi_balance, removed_at
    )
    VALUES (
      uid,
      coalesce(nm, 'Imported wallet'),
      p_address,
      rh,
      true,
      0,
      0,
      NULL
    )
    RETURNING * INTO wal;
  END IF;

  RETURN jsonb_build_object(
    'id', wal.id,
    'user_id', wal.user_id,
    'name', wal.name,
    'address', wal.address,
    'is_active', wal.is_active,
    'ousd_balance', wal.ousd_balance,
    'pi_balance', wal.pi_balance,
    'created_at', wal.created_at,
    'restored', true
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.import_openpay_wallet(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_openpay_wallet(text, text, text) TO authenticated;

-- Attach recovery to an owned wallet that never had a phrase (legacy Main Wallet).
-- Keeps the existing OpenPay Pro address and balances; future imports restore this row.
CREATE OR REPLACE FUNCTION public.attach_wallet_recovery(
  p_wallet_id uuid,
  p_recovery_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  wal public.wallets%ROWTYPE;
  rh text := lower(trim(p_recovery_hash));
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF rh IS NULL OR length(rh) < 32 THEN
    RAISE EXCEPTION 'Invalid recovery hash';
  END IF;

  SELECT * INTO wal
  FROM public.wallets
  WHERE id = p_wallet_id AND user_id = uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  IF wal.recovery_hash IS NOT NULL THEN
    RAISE EXCEPTION 'This wallet already has a recovery phrase';
  END IF;

  IF EXISTS (SELECT 1 FROM public.wallets WHERE recovery_hash = rh AND id <> p_wallet_id) THEN
    RAISE EXCEPTION 'Recovery phrase is already used by another wallet';
  END IF;

  UPDATE public.wallets
  SET recovery_hash = rh
  WHERE id = wal.id
  RETURNING * INTO wal;

  RETURN jsonb_build_object(
    'id', wal.id,
    'name', wal.name,
    'address', wal.address,
    'attached', true
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.attach_wallet_recovery(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attach_wallet_recovery(uuid, text) TO authenticated;

-- Whether the caller's wallet already has recovery attached (without exposing the hash).
CREATE OR REPLACE FUNCTION public.wallet_has_recovery(p_wallet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.wallets
    WHERE id = p_wallet_id
      AND user_id = auth.uid()
      AND removed_at IS NULL
      AND recovery_hash IS NOT NULL
  );
$$;

REVOKE EXECUTE ON FUNCTION public.wallet_has_recovery(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wallet_has_recovery(uuid) TO authenticated;

-- Soft-remove a wallet (keeps balances for phrase restore). Always leave ≥1 active wallet.
CREATE OR REPLACE FUNCTION public.remove_openpay_wallet(p_wallet_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  wal public.wallets%ROWTYPE;
  remaining int;
  nxt uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO wal
  FROM public.wallets
  WHERE id = p_wallet_id AND user_id = uid AND removed_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  SELECT count(*) INTO remaining
  FROM public.wallets
  WHERE user_id = uid AND removed_at IS NULL AND id <> p_wallet_id;

  IF remaining < 1 THEN
    RAISE EXCEPTION 'Keep at least one wallet';
  END IF;

  UPDATE public.wallets
  SET removed_at = now(), is_active = false
  WHERE id = wal.id;

  IF wal.is_active THEN
    SELECT id INTO nxt
    FROM public.wallets
    WHERE user_id = uid AND removed_at IS NULL
    ORDER BY created_at ASC
    LIMIT 1;

    IF nxt IS NOT NULL THEN
      UPDATE public.wallets SET is_active = true WHERE id = nxt;
    END IF;
  END IF;

  RETURN jsonb_build_object('removed', true, 'id', p_wallet_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.remove_openpay_wallet(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_openpay_wallet(uuid) TO authenticated;
