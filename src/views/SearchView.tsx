import React, { useState, useEffect, useRef } from 'react';
import { useMusic } from '../context/MusicContext';
import { Track } from '../types';
import { TrackCard } from '../components/TrackCard';
import { TrackRow } from '../components/TrackRow';
import {
  Search as SearchIcon,
  X,
  Mic,
  History,
  Loader2,
  Music2,
  Flame,
  Globe2,
  Coffee,
  Mic2,
  BookOpen,
  Dumbbell,
  Radio,
  Disc,
} from 'lucide-react';
import {
  searchTracks,
  getSearchSuggestions,
  resolveSingleSongLink,
} from '../services/api';

const BROWSE_GENRES = [
  { name: 'Arabic Hits', query: 'Top 50 Arabic Hits', color: 'from-purple-800 to-indigo-950' },
  { name: 'Global Pop', query: 'Global Pop Hits', color: 'from-blue-800 to-slate-950' },
  { name: 'Chill & Relax', query: 'Calm Chill Relax Lofi', color: 'from-teal-800 to-emerald-950' },
  { name: 'Tunisian Rap', query: 'Tunisian Rap', color: 'from-amber-800 to-yellow-950' },
  { name: 'Deep Focus', query: 'Deep Focus Study', color: 'from-emerald-800 to-teal-950' },
  { name: 'Workout', query: 'Gym Workout Motivation', color: 'from-rose-800 to-pink-950' },
  { name: 'Hip-Hop', query: 'Hip Hop Rap Essentials', color: 'from-orange-800 to-amber-950' },
  { name: 'R&B & Soul', query: 'R&B Soul Essentials', color: 'from-red-800 to-rose-950' },
  { name: 'Electronic', query: 'Electronic Dance Music EDM', color: 'from-cyan-800 to-blue-950' },
  { name: 'Rock Classics', query: 'Rock Classics', color: 'from-stone-800 to-zinc-950' },
  { name: 'Raï Music', query: 'Rai Algerian Music', color: 'from-lime-800 to-green-950' },
  { name: 'Mahraganat', query: 'Egyptian Mahraganat', color: 'from-fuchsia-800 to-purple-950' },
];

export const SearchView: React.FC = () => {
  const { setModalAudioRecognitionOpen, openCollection, playTrack } = useMusic();

  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'song' | 'playlist' | 'artist'>('all');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('recent_searches') || '[]');
    } catch {
      return [];
    }
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<any>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const hasSearchedRef = useRef(false);

  // Click outside search container closes suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle live suggestions
  useEffect(() => {
    if (hasSearchedRef.current || !query.trim() || query.length < 2) {
      setSuggestions([]);
      return;
    }

    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      if (hasSearchedRef.current) return;
      const list = await getSearchSuggestions(query.trim());
      if (!hasSearchedRef.current) {
        setSuggestions(list);
        setShowSuggestions(list.length > 0);
      }
    }, 200);

    return () => clearTimeout(debounceTimerRef.current);
  }, [query]);

  const saveRecentSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const updated = [trimmed, ...prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 10);
      try {
        localStorage.setItem('recent_searches', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const removeRecentSearch = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((item) => item !== term);
      try {
        localStorage.setItem('recent_searches', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const executeSearch = async (searchTerm: string, filter = activeFilter) => {
    const q = searchTerm.trim();
    if (!q) return;

    // Immediately suppress suggestions and cancel any queued suggestion timer
    hasSearchedRef.current = true;
    setShowSuggestions(false);
    setSuggestions([]);
    clearTimeout(debounceTimerRef.current);

    // Immediately blur input so the mobile keyboard disappears (as requested!)
    inputRef.current?.blur();
    setLoading(true);

    // Direct link detection
    if (/(?:music\.youtube\.com|youtube\.com|youtu\.be)\//i.test(q)) {
      try {
        const directTrack = await resolveSingleSongLink(q);
        setResults([directTrack]);
        setLoading(false);
        return;
      } catch {}
    }

    saveRecentSearch(q);

    try {
      const tracks = await searchTracks(q, filter);
      setResults(tracks);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeSearch(query);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = (term: string) => {
    hasSearchedRef.current = true;
    setShowSuggestions(false);
    setSuggestions([]);
    clearTimeout(debounceTimerRef.current);
    setQuery(term);
    executeSearch(term);
  };

  const handleFilterChange = (filter: 'all' | 'song' | 'playlist' | 'artist') => {
    setActiveFilter(filter);
    if (query.trim()) {
      executeSearch(query, filter);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-20 select-none">
      {/* Search Input Bar */}
      <div ref={searchContainerRef} className="relative w-full max-w-xl">
        <div className="relative flex items-center">
          <SearchIcon className="absolute left-4 w-5 h-5 text-white/40 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Songs, artists, or paste a link..."
            value={query}
            onChange={(e) => {
              hasSearchedRef.current = false;
              setQuery(e.target.value);
            }}
            onFocus={() => {
              if (!hasSearchedRef.current && suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-[#1c1c1e] glass-panel border border-white/10 rounded-full pl-12 pr-20 py-3.5 text-white placeholder:text-white/40 text-sm font-medium focus:outline-none focus:border-[#ff6b1a] transition-all shadow-lg"
          />

          <div className="absolute right-3 flex items-center gap-1">
            {query && (
              <button
                onClick={() => {
                  hasSearchedRef.current = false;
                  setQuery('');
                  setResults([]);
                  setSuggestions([]);
                  setShowSuggestions(false);
                  inputRef.current?.focus();
                }}
                className="p-1.5 text-white/40 hover:text-white rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setModalAudioRecognitionOpen(true)}
              className="p-2 text-white/50 hover:text-[#ff6b1a] transition-colors"
              title="Identify song (Shazam)"
            >
              <Mic className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Typeahead Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#1c1c1e] glass-panel border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-40 flex flex-col py-1 animate-in fade-in zoom-in-95 duration-150">
            {suggestions.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectSuggestion(item)}
                className="flex items-center gap-3 px-4 py-2.5 text-left text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <SearchIcon className="w-4 h-4 text-white/40" />
                <span className="truncate">{item}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filter Pills */}
      {query.trim() && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {(['all', 'song', 'playlist', 'artist'] as const).map((f) => (
            <button
              key={f}
              onClick={() => handleFilterChange(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all ${
                activeFilter === f
                  ? 'bg-white text-black shadow-md'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/5'
              }`}
            >
              {f === 'all' ? 'All' : f === 'song' ? 'Songs' : f === 'playlist' ? 'Playlists' : 'Artists'}
            </button>
          ))}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 mt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-3 rounded-2xl bg-white/[0.03] animate-pulse flex flex-col gap-2.5">
              <div className="w-full aspect-square bg-white/5 rounded-xl" />
              <div className="h-4 bg-white/5 rounded w-3/4" />
              <div className="h-3 bg-white/5 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Search Results */}
      {!loading && results.length > 0 && (
        <div className="flex flex-col gap-4 mt-2">
          <h3 className="text-xl font-bold text-white tracking-tight">Top Results</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {results.map((t) => (
              <TrackCard key={t.id} track={t} />
            ))}
          </div>
        </div>
      )}

      {/* Recent Searches (when not searching) */}
      {!query && recentSearches.length > 0 && (
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-bold uppercase tracking-wider text-white/50">Recent Searches</h4>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((term, i) => (
              <div
                key={i}
                onClick={() => {
                  setQuery(term);
                  executeSearch(term);
                }}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-3.5 py-1.5 rounded-full border border-white/5 text-sm text-white/80 cursor-pointer group transition-colors"
              >
                <History className="w-3.5 h-3.5 text-white/40" />
                <span>{term}</span>
                <button
                  onClick={(e) => removeRecentSearch(term, e)}
                  className="text-white/30 hover:text-white p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Browse Categories (when no search query) */}
      {!query && (
        <div className="flex flex-col gap-4 mt-4">
          <h3 className="text-xl font-bold text-white tracking-tight">Browse All</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {BROWSE_GENRES.map((g) => (
              <div
                key={g.name}
                onClick={() => {
                  openCollection('playlist', g.query, g.query);
                }}
                className={`rounded-2xl p-4 sm:p-5 aspect-[16/10] bg-gradient-to-br ${g.color} cursor-pointer hover:scale-[1.03] active:scale-95 transition-all shadow-lg flex flex-col justify-end`}
              >
                <h4 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                  {g.name}
                </h4>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
