-- ════════════════════════════════════════════════════════════════════════
-- 0022_agent_hub_fields.sql — per-agent fields the (dynamic) Agent Hub needs
--   The Agent Hub renders one shared personal-hub Overview for whoever logs
--   in, so the two truly per-agent values that aren't derivable have to live
--   in the directory:
--     • marketing_request_url — the agent's Asana "request marketing" form
--     • fub_name              — the agent's name as it appears in Follow Up Boss
--                               (usually equals `name`; only stored when it differs)
--   The Acuity "book marketing" URL is generated at runtime from name/email/phone,
--   so it doesn't need a column.
-- ════════════════════════════════════════════════════════════════════════

alter table agents add column if not exists marketing_request_url text;
alter table agents add column if not exists fub_name text;

-- Seed the senior agents' Asana request forms (from the existing personal hubs).
update agents set marketing_request_url = v.url from (values
  ('alex.stoykov@compass.com',        'https://form.asana.com/?k=pt7tbwwT4JUDdxLj2fbm5Q&d=7720513273924'),
  ('sam.abadi@compass.com',           'https://form.asana.com/?k=5GNV6fln0YFlMiZrsAJ2Kw&d=7720513273924'),
  ('shelly.kapoor@compass.com',       'https://form.asana.com/?k=7BkpF9s9vX9oGTsiYl-ftg&d=7720513273924'),
  ('nicolas.gamboawills@compass.com', 'https://form.asana.com/?k=8Lw82C2zcajV-xHYEw_75w&d=7720513273924'),
  ('julianlevit@compass.com',         'https://form.asana.com/?k=RJKIMRElm8E7ppFlclt_fA&d=7720513273924'),
  ('mino.conenna@compass.com',        'https://form.asana.com/?k=3-JUPCfHN838A8krYo9isQ&d=7720513273924'),
  ('angela.engelbrecht@compass.com',  'https://form.asana.com/?k=PA4Y8j5F1YR8dzSfesDe6A&d=7720513273924'),
  ('layne.zagorin@compass.com',       'https://form.asana.com/?k=kZ8ielvYc-6DkzJ0Cej_qQ&d=7720513273924'),
  ('barbara.laken@compass.com',       'https://form.asana.com/?k=espwfceO9_elFbLyN8iBbw&d=7720513273924'),
  ('gabriel.rendon@compass.com',      'https://form.asana.com/?k=Dn1_kKOAfdejXCnkIIEktA&d=7720513273924'),
  ('matthew.clevenger@compass.com',   'https://form.asana.com/?k=EqgNKJpvBteZLA1laayeAQ&d=7720513273924')
) as v(email, url)
where lower(agents.email) = v.email and agents.marketing_request_url is null;

-- FUB name variants that differ from the directory name.
update agents set fub_name = 'Alexandre Stoykov'
  where lower(email) = 'alex.stoykov@compass.com' and fub_name is null;
