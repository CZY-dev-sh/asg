-- ════════════════════════════════════════════════════════════════════════
-- 0014_address_matching.sql — standardized address key for robust IDX linking
-- ════════════════════════════════════════════════════════════════════════
-- normalize_address() only lowercases + strips punctuation, so "Place" vs "Pl",
-- "West" vs "W", "Unit 3" vs "#3", or a trailing ", Chicago, Illinois 60610"
-- break the exact-equality match the IDX sync relies on. address_std() also
-- standardizes directionals, street types and unit markers so the *street core*
-- lines up, enabling exact + safe prefix matching across the two formats.

create or replace function address_std(addr text)
returns text language sql immutable as $$
  select nullif(btrim(regexp_replace(
    replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
    replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
    replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
    replace(replace(
      ' ' || normalize_address(addr) || ' ',
      ' north ', ' n '),  ' south ', ' s '),  ' east ', ' e '),  ' west ', ' w '),
      ' northeast ', ' ne '), ' northwest ', ' nw '), ' southeast ', ' se '), ' southwest ', ' sw '),
      ' street ', ' st '), ' avenue ', ' ave '), ' place ', ' pl '), ' road ', ' rd '),
      ' drive ', ' dr '), ' lane ', ' ln '), ' boulevard ', ' blvd '), ' court ', ' ct '),
      ' terrace ', ' ter '), ' parkway ', ' pkwy '), ' highway ', ' hwy '), ' circle ', ' cir '),
      ' square ', ' sq '), ' trail ', ' trl '), ' apartment ', ' '), ' apt ', ' '),
      ' unit ', ' '), ' suite ', ' '), ' ste ', ' '), ' number ', ' '),
      ' illinois ', ' il '), ' indiana ', ' in '), ' wisconsin ', ' wi '), ' united states ', ' ')
  , '\s+', ' ', 'g')), '');
$$;

alter table listings      add column if not exists address_std text
  generated always as (address_std(address)) stored;
alter table idx_listings  add column if not exists address_std text
  generated always as (address_std(address)) stored;

create index if not exists listings_addr_std_idx      on listings (address_std);
create index if not exists idx_listings_addr_std_idx  on idx_listings (address_std);
create index if not exists listings_addr_std_trgm
  on listings using gin (address_std gin_trgm_ops);
create index if not exists idx_listings_addr_std_trgm
  on idx_listings using gin (address_std gin_trgm_ops);
