CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION search_politicians_by_name(search_query text)
RETURNS TABLE (
  id                 uuid,
  person_id          uuid,
  political_position text,
  political_party    text,
  tenure_start       date,
  tenure_end         date,
  photo_url          text,
  photo_source_url   text,
  photo_source_name  text,
  is_processed       boolean,
  created_at         timestamptz,
  person             jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    pol.id, pol.person_id, pol.political_position, pol.political_party,
    pol.tenure_start, pol.tenure_end,
    pol.photo_url, pol.photo_source_url, pol.photo_source_name,
    pol.is_processed, pol.created_at,
    to_jsonb(p) AS person
  FROM politicians pol
  JOIN people p ON p.id = pol.person_id
  WHERE unaccent(lower(p.name)) ILIKE unaccent(lower('%' || search_query || '%'))
  ORDER BY pol.created_at DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION search_politicians_by_name(text) TO anon, authenticated;
