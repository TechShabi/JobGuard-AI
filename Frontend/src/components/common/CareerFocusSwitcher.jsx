import { useState, useEffect, useRef, useCallback } from 'react';
import { Target, Plus, ChevronDown, Check, Archive } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  listCareerFocusesService,
  createCareerFocusService,
  activateCareerFocusService,
  archiveCareerFocusService,
} from '../../services/careerFocus.service';

// Compact global indicator + switcher for the user's Career Focus(es)
// (product-spec sections 26-30). Starter/Go show a single focus with no
// switcher chrome; Pro shows a dropdown to switch between multiple active
// focuses and create new ones. The server (careerFocusService.js) is the
// real authority on the active-focus limit — this component just reflects
// whatever it returns and surfaces its message when a create is refused.
export default function CareerFocusSwitcher() {
  const { user } = useAuth();
  const [focuses, setFocuses] = useState([]);
  const [limit, setLimit] = useState(1);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const wrapRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await listCareerFocusesService();
      setFocuses(res.data?.data?.focuses || []);
      setLimit(res.data?.data?.limit); // null = unlimited (Pro)
    } catch (_) {
      // Career Focus is additive context — a failed load never blocks the
      // rest of the app, it just hides the switcher.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setCreating(false);
        setError(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user || !loaded) return null;

  const activeFocuses = focuses.filter((f) => f.is_active);
  const archivedFocuses = focuses.filter((f) => !f.is_active);
  // Most-recently-used active focus — same "current" rule the backend
  // uses (careerFocusService.js#getActiveFocus).
  const current = activeFocuses[0] || null;
  const atLimit = limit !== null && activeFocuses.length >= limit;

  async function handleActivate(id) {
    try {
      await activateCareerFocusService(id);
      await load();
      setOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not switch Career Focus.');
    }
  }

  async function handleArchive(id, e) {
    e.stopPropagation();
    try {
      await archiveCareerFocusService(id);
      await load();
    } catch (_) {
      /* non-critical — leave the list as-is on failure */
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      await createCareerFocusService({ name: newName.trim() });
      setNewName('');
      setCreating(false);
      setError(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create Career Focus.');
    }
  }

  // Nothing to show yet and nothing to switch to — offer just a quiet
  // "set a focus" affordance rather than empty chrome.
  if (!current && !creating) {
    return (
      <div className="relative" ref={wrapRef}>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-emerald-600 transition-colors"
        >
          <Target size={15} />
          <span>Set a Career Focus</span>
        </button>
        {creating && (
          <CreatePanel
            newName={newName}
            setNewName={setNewName}
            onCreate={handleCreate}
            onCancel={() => { setCreating(false); setError(null); }}
            error={error}
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-emerald-600 border border-slate-200 rounded-full px-3 py-1.5 transition-colors"
        title="Your active Career Focus — Opportunity, Resume, and Interview use this context"
      >
        <Target size={15} className="text-emerald-600" />
        <span className="max-w-[140px] truncate">{current?.name || 'Career Focus'}</span>
        {(limit === null || focuses.length > 1) && <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-2">
          <div className="px-3 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Career Focus{limit === null ? 'es' : ''}
          </div>

          {activeFocuses.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 cursor-pointer"
              onClick={() => handleActivate(f.id)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Check size={14} className={f.id === current?.id ? 'text-emerald-600' : 'text-transparent'} />
                <span className="truncate text-sm text-slate-700">{f.name}</span>
              </div>
              {activeFocuses.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => handleArchive(f.id, e)}
                  className="text-slate-300 hover:text-slate-500"
                  title="Archive this focus"
                >
                  <Archive size={13} />
                </button>
              )}
            </div>
          ))}

          {archivedFocuses.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Archived
              </div>
              {archivedFocuses.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 cursor-pointer text-slate-500"
                  onClick={() => handleActivate(f.id)}
                >
                  <span className="truncate text-sm">{f.name}</span>
                  <span className="text-xs">Reactivate</span>
                </div>
              ))}
            </>
          )}

          <div className="px-3 pt-2 mt-1 border-t border-slate-100">
            {creating ? (
              <CreatePanel
                inline
                newName={newName}
                setNewName={setNewName}
                onCreate={handleCreate}
                onCancel={() => { setCreating(false); setError(null); }}
                error={error}
              />
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 py-1.5"
              >
                <Plus size={14} /> New Career Focus
              </button>
            )}
            {atLimit && !creating && (
              <p className="text-xs text-slate-400 pb-1">
                {limit === 1
                  ? 'Your plan supports 1 active Career Focus. Upgrade to Career Pro for multiple.'
                  : `Your plan supports up to ${limit} active Career Focuses.`}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CreatePanel({ newName, setNewName, onCreate, onCancel, error, inline = false }) {
  return (
    <div className={inline ? 'py-2' : 'absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-3'}>
      <input
        autoFocus
        type="text"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onCreate()}
        placeholder="e.g. MERN Backend Developer"
        className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
      />
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={onCreate}
          className="text-xs font-medium bg-emerald-600 text-white rounded-md px-2.5 py-1 hover:bg-emerald-700"
        >
          Create
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-medium text-slate-500 hover:text-slate-700 px-2.5 py-1"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
