-- sym-o1bf: engagement_log_message_type_check rejected streak-at-risk / trial-low / trial-zero,
-- which ProactiveMessageService writes. Failed inserts silently broke proactive-send dedup
-- (trial nudges are deduped "once per stage, ever"; streak-at-risk "once per day"), so users
-- could receive duplicate proactive messages. Extend the constraint to the full
-- ProactiveMessageType union (symancy-backend/src/services/proactive/ProactiveMessageService.ts).

ALTER TABLE public.engagement_log
  DROP CONSTRAINT IF EXISTS engagement_log_message_type_check;

ALTER TABLE public.engagement_log
  ADD CONSTRAINT engagement_log_message_type_check
  CHECK (message_type = ANY (ARRAY[
    'inactive-reminder',
    'weekly-checkin',
    'daily-fortune',
    'morning-insight',
    'evening-insight',
    'streak-at-risk',
    'trial-low',
    'trial-zero'
  ]));
