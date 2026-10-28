-- Restrict direct API/RPC execution of the SECURITY DEFINER event-trigger function.
-- The function remains installed and its event-trigger association is unchanged.
-- Apply only after confirming the live function definition and event-trigger association.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
