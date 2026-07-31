-- Backfill created_at dates for leads created from Unibox/Instantly emails
UPDATE public.leads l
SET created_at = ue.received_at
FROM public.unibox_emails ue
WHERE (l.id = ue.converted_to_lead_id OR (l.email = ue.sender_email AND l.source = 'Instantly'))
  AND ue.received_at IS NOT NULL;
