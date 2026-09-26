// Client-side persistence for Opportunity Find state.
// Logged-in users also get server-side SavedOpportunity / OpportunitySearch;
// this local layer covers guests and offline restore of the last search.

const KEYS = {
  LAST_SEARCH: "jg_opp_last_search_v1",
  RECENT: "jg_opp_recent_searches_v1",
  SAVED: "jg_opp_saved_v1",
  VIEWED: "jg_opp_viewed_v1",
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // storage full / private mode
  }
}

export function saveLastSearch(payload) {
  write(KEYS.LAST_SEARCH, { ...payload, savedAt: Date.now() });
  // Also push into recent list
  const recent = read(KEYS.RECENT, []);
  const entry = {
    role: payload.query?.role,
    location: payload.query?.location,
    remote_preference: payload.query?.remote_preference,
    experience: payload.query?.experience,
    skills: payload.query?.skills,
    result_count: payload.opportunities?.length || 0,
    is_live: payload.meta?.is_live || false,
    savedAt: Date.now(),
  };
  const next = [entry, ...recent.filter((r) => r.role !== entry.role || r.location !== entry.location)].slice(0, 10);
  write(KEYS.RECENT, next);
}

export function getLastSearch() {
  return read(KEYS.LAST_SEARCH, null);
}

export function getRecentSearchesLocal() {
  return read(KEYS.RECENT, []);
}

export function markViewedLocal(opp) {
  const list = read(KEYS.VIEWED, []);
  const next = [
    { id: opp.id, role: opp.role, company: opp.company, at: Date.now() },
    ...list.filter((x) => x.id !== opp.id),
  ].slice(0, 30);
  write(KEYS.VIEWED, next);
}

export function getSavedLocal() {
  return read(KEYS.SAVED, []);
}

export function upsertSavedLocal(opp, status = "saved") {
  const list = read(KEYS.SAVED, []);
  const row = {
    external_id: opp.id,
    status,
    role: opp.role,
    company: opp.company,
    location: opp.location,
    source_url: opp.source_url,
    source_platform: opp.source_platform,
    payload: opp,
    verification: opp.verification,
    updatedAt: Date.now(),
  };
  const next = [row, ...list.filter((x) => x.external_id !== opp.id)];
  write(KEYS.SAVED, next);
  return row;
}

export function removeSavedLocal(externalId) {
  write(
    KEYS.SAVED,
    read(KEYS.SAVED, []).filter((x) => x.external_id !== externalId)
  );
}

export function getLocalMark(externalId) {
  const saved = read(KEYS.SAVED, []).find((x) => x.external_id === externalId);
  return saved?.status || null;
}
