-- Migration: 20260526000003_trial_conversion_funnel_view.sql
-- Purpose: Admin analytics VIEW for trial→paid conversion funnel.
--
-- Computes a single-row cohort summary from source-of-truth tables:
--   unified_user_credits  — who received the welcome gift (free_credit_granted)
--   credit_transactions   — who made a purchase (transaction_type = 'purchase')
--
-- No event counters are stored; the view is always consistent with current state.
-- See spec: docs/superpowers/specs/2026-05-26-trial-followup-design.md §1 + §4

CREATE OR REPLACE VIEW public.trial_conversion_funnel AS
SELECT
    -- Total users who received a welcome-gift (trial cohort size)
    COUNT(*) FILTER (
        WHERE uuc.free_credit_granted = TRUE
    ) AS granted,

    -- Trial users who have fully exhausted their welcome balance
    COUNT(*) FILTER (
        WHERE uuc.free_credit_granted = TRUE
          AND (uuc.credits_basic + uuc.credits_pro + uuc.credits_cassandra) = 0
    ) AS exhausted,

    -- Trial users who made at least one purchase
    COUNT(*) FILTER (
        WHERE uuc.free_credit_granted = TRUE
          AND EXISTS (
              SELECT 1
              FROM public.credit_transactions ct
              WHERE ct.unified_user_id = uuc.unified_user_id
                AND ct.transaction_type = 'purchase'
          )
    ) AS purchased,

    -- Conversion rate: purchased / granted (NULL-safe)
    (
        COUNT(*) FILTER (
            WHERE uuc.free_credit_granted = TRUE
              AND EXISTS (
                  SELECT 1
                  FROM public.credit_transactions ct
                  WHERE ct.unified_user_id = uuc.unified_user_id
                    AND ct.transaction_type = 'purchase'
              )
        )::numeric
        / NULLIF(
            COUNT(*) FILTER (WHERE uuc.free_credit_granted = TRUE),
            0
          )
    ) AS conversion_rate

FROM public.unified_user_credits uuc;

COMMENT ON VIEW public.trial_conversion_funnel IS
'Single-row admin analytics funnel for the trial→paid cohort. '
'granted = users who received the welcome gift; '
'exhausted = granted users with zero remaining balance; '
'purchased = granted users with at least one credit_transactions row of transaction_type=''purchase''; '
'conversion_rate = purchased / granted. '
'Source of truth: unified_user_credits + credit_transactions. No drift possible.';

-- Restrict SELECT to service_role only (admin-only data; consistent with
-- GRANT EXECUTE … TO service_role on other admin RPCs in this project).
-- authenticated and anon are intentionally excluded.
GRANT SELECT ON public.trial_conversion_funnel TO service_role;
