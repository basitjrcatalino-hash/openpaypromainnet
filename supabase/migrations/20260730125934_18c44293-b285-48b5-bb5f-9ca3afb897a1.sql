GRANT SELECT ON public.ot_token_chat_messages TO anon;
GRANT SELECT, INSERT, DELETE ON public.ot_token_chat_messages TO authenticated;
GRANT ALL ON public.ot_token_chat_messages TO service_role;