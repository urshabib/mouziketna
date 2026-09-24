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
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  searchTracks,
  getSearchSuggestions,
  resolveSingleSongLink,
  FALLBACK_ART,
} from '../services/api';

const BROWSE_GENRES = [
  {
    name: 'Arabic Hits',
    query: 'Top 50 Arabic Hits',
    tag: 'Trending',
    gradient: 'from-purple-900/40 via-indigo-950/60 to-black/80',
    border: 'border-purple-500/20 hover:border-purple-400/40',
    accentText: 'text-purple-400',
    icon: Flame,
  },
  {
    name: 'Global Pop',
    query: 'Global Pop Hits',
    tag: 'Top Charts',
    gradient: 'from-blue-900/40 via-cyan-950/60 to-black/80',
    border: 'border-cyan-500/20 hover:border-cyan-400/40',
    accentText: 'text-cyan-400',
    icon: Globe2,
  },
  {
    name: 'Chill & Relax',
    query: 'Calm Chill Relax Lofi',
    tag: 'Vibes',
    gradient: 'from-emerald-900/40 via-teal-950/60 to-black/80',
    border: 'border-emerald-500/20 hover:border-emerald-400/40',
    accentText: 'text-emerald-400',
    icon: Coffee,
  },
  {
    name: 'Tunisian Rap',
    query: 'Tunisian Rap',
    tag: 'Hip Hop',
    gradient: 'from-amber-900/40 via-orange-950/60 to-black/80',
    border: 'border-amber-500/20 hover:border-amber-400/40',
    accentText: 'text-amber-400',
    icon: Mic2,
  },
  {
    name: 'Deep Focus',
    query: 'Deep Focus Study',
    tag: 'Study & Work',
    gradient: 'from-indigo-900/40 via-slate-950/60 to-black/80',
    border: 'border-indigo-500/20 hover:border-indigo-400/40',
    accentText: 'text-indigo-400',
    icon: BookOpen,
  },
  {
    name: 'Workout',
    query: 'Gym Workout Motivation',
    tag: 'Energy',
    gradient: 'from-rose-900/40 via-red-950/60 to-black/80',
    border: 'border-rose-500/20 hover:border-rose-400/40',
    accentText: 'text-rose-400',
    icon: Dumbbell,
  },
  {
    name: 'Hip-Hop',
    query: 'Hip Hop Rap Essentials',
    tag: 'Urban',
    gradient: 'from-orange-900/40 via-yellow-950/60 to-black/80',
    border: 'border-orange-500/20 hover:border-orange-400/40',
    accentText: 'text-orange-400',
    icon: Disc,
  },
  {
    name: 'R&B & Soul',
    query: 'R&B Soul Essentials',
    tag: 'Soulful',
    gradient: 'from-red-900/40 via-pink-950/60 to-black/80',
    border: 'border-red-500/20 hover:border-red-400/40',
    accentText: 'text-red-400',
    icon: Music2,
  },
  {
    name: 'Electronic',
    query: 'Electronic Dance Music EDM',
    tag: 'Dance',
    gradient: 'from-cyan-900/40 via-blue-950/60 to-black/80',
    border: 'border-sky-500/20 hover:border-sky-400/40',
    accentText: 'text-sky-400',
    icon: Radio,
  },
  {
    name: 'Rock Classics',
    query: 'Rock Classics',
    tag: 'Classics',
    gradient: 'from-violet-900/40 via-stone-950/60 to-black/80',
    border: 'border-violet-500/20 hover:border-violet-400/40',
    accentText: 'text-violet-400',
    icon: Sparkles,
  },
  {
    name: 'Raï Music',
    query: 'Rai Algerian Music',
    tag: 'Traditional',
    gradient: 'from-teal-900/40 via-green-950/60 to-black/80',
    border: 'border-teal-500/20 hover:border-teal-400/40',
    accentText: 'text-teal-400',
    icon: Disc,
  },
  {
    name: 'Mahraganat',
    query: 'Egyptian Mahraganat',
    tag: 'Festival',
    gradient: 'from-pink-900/40 via-fuchsia-950/60 to-black/80',
    border: 'border-pink-500/20 hover:border-pink-400/40',
    accentText: 'text-pink-400',
    icon: Flame,
  },
];

const REAL_TRENDING_SEARCHES = [
  { label: 'Die With A Smile', query: 'Die With A Smile Lady Gaga Bruno Mars', tag: '#1 Global', icon: Flame },
  { label: 'Espresso', query: 'Espresso Sabrina Carpenter', tag: 'Billboard', icon: Zap },
  { label: 'Birds of a Feather', query: 'Birds of a Feather Billie Eilish', tag: 'Hot', icon: Sparkles },
  { label: 'APT.', query: 'Rose Bruno Mars APT', tag: 'Viral', icon: TrendingUp },
  { label: 'Good Luck, Babe!', query: 'Good Luck Babe Chappell Roan', tag: 'Charts', icon: Flame },
  { label: 'Not Like Us', query: 'Not Like Us Kendrick Lamar', tag: 'Top Rap', icon: Mic2 },
  { label: 'A Bar Song (Tipsy)', query: 'A Bar Song Tipsy Shaboozey', tag: 'Hot 100', icon: Disc },
  { label: 'Timeless', query: 'The Weeknd Playboi Carti Timeless', tag: 'New', icon: Zap },
  { label: 'Beautiful Things', query: 'Beautiful Things Benson Boone', tag: 'Global', icon: Globe2 },
  { label: 'Lose Control', query: 'Lose Control Teddy Swims', tag: 'Soul', icon: Music2 },
  { label: 'Taste', query: 'Taste Sabrina Carpenter', tag: 'Viral', icon: Flame },
  { label: 'Million Dollar Baby', query: 'Million Dollar Baby Tommy Richman', tag: 'Groove', icon: Disc },
];

export const SearchView: React.FC = () => {
  const { setModalAudioRecognitionOpen, openCollection, playTrack, toggleLikeTrack, userProfile } = useMusic();

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
      <div ref={searchContainerRef} className="relative w-full max-w-2xl">
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
            className="w-full bg-[#1c1c1e] glass-panel border border-white/10 rounded-full pl-12 pr-24 py-3.5 text-white placeholder:text-white/40 text-sm font-medium focus:outline-none focus:border-[#ff6b1a] transition-all shadow-lg"
          />

          <div className="absolute right-3.5 flex items-center gap-1">
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
                className="p-1.5 text-white/40 hover:text-white rounded-full transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setModalAudioRecognitionOpen(true)}
              className="p-2 text-white/50 hover:text-[#ff6b1a] transition-colors cursor-pointer"
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
                <SearchIcon className="w-4 h-4 text-white/40 flex-shrink-0" />
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
              className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all cursor-pointer ${
                activeFilter === f
                  ? 'bg-white text-black shadow-md font-extrabold'
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
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-white/50">Recent Searches</h4>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((term, i) => (
              <div
                key={i}
                onClick={() => {
                  setQuery(term);
                  executeSearch(term);
                }}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-3.5 py-1.5 rounded-full border border-white/5 text-xs sm:text-sm text-white/80 cursor-pointer group transition-colors"
              >
                <History className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
                <span>{term}</span>
                <button
                  onClick={(e) => removeRecentSearch(term, e)}
                  className="text-white/30 hover:text-white p-0.5 ml-0.5 rounded-full"
                  title="Remove search"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trending Searches: Drop down instead of going out of screen, smaller text */}
      {!query && (
        <div className="flex flex-col gap-2.5 mt-1">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#ff6b1a]" />
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-white/70">Trending Searches</h4>
          </div>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {REAL_TRENDING_SEARCHES.map((vib) => {
              const Icon = vib.icon;
              return (
                <button
                  key={vib.label}
                  type="button"
                  onClick={() => {
                    setQuery(vib.query);
                    executeSearch(vib.query);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg sm:rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 hover:border-[#ff6b1a]/40 text-[11px] sm:text-xs font-semibold text-white/90 hover:text-white transition-all cursor-pointer shadow-sm group active:scale-95"
                >
                  <Icon className="w-3 h-3 text-[#ff6b1a] group-hover:scale-110 transition-transform flex-shrink-0" />
                  <span className="truncate max-w-[150px] sm:max-w-none">{vib.label}</span>
                  <span className="px-1 py-0.5 rounded text-[8px] font-black uppercase bg-[#ff6b1a]/20 text-[#ff6b1a] flex-shrink-0">
                    {vib.tag}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Browse Categories (when no search query) */}
      {!query && (
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-white tracking-tight">Browse Categories</h3>
            <span className="text-xs font-semibold text-white/40">{BROWSE_GENRES.length} genres</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {BROWSE_GENRES.map((g) => {
              const Icon = g.icon;
              return (
                <div
                  key={g.name}
                  onClick={() => {
                    openCollection('playlist', g.query, g.name);
                  }}
                  className={`group relative rounded-2xl p-4 sm:p-5 aspect-[16/11] bg-gradient-to-br ${g.gradient} ${g.border} cursor-pointer hover:scale-[1.03] active:scale-95 transition-all duration-300 shadow-md flex flex-col justify-between overflow-hidden backdrop-blur-md`}
                >
                  {/* Decorative background watermark */}
                  <Icon className="absolute -bottom-2 -right-2 w-16 h-16 opacity-10 group-hover:opacity-20 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 pointer-events-none" />

                  {/* Top tag & icon */}
                  <div className="flex items-center justify-between z-10">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/10 text-white/70 backdrop-blur-sm">
                      {g.tag}
                    </span>
                    <Icon className={`w-5 h-5 ${g.accentText} opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300`} />
                  </div>

                  {/* Title & subtext */}
                  <div className="z-10 flex flex-col gap-0.5">
                    <h4 className="font-extrabold text-sm sm:text-base text-white tracking-tight leading-snug">
                      {g.name}
                    </h4>
                    <p className="text-[10px] text-white/40 font-medium">Explore Hits</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
