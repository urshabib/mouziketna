import React, { useState, useRef, useEffect } from 'react';
import { useMusic } from '../context/MusicContext';
import {
  X,
  MessageSquare,
  Globe,
  Instagram,
  Send,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { submitFeedback } from '../services/api';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  const { globalUser, userProfile, t } = useMusic();

  const [feedbackCategory, setFeedbackCategory] = useState<'Report Problem' | 'Suggestion'>('Report Problem');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSentSuccess, setFeedbackSentSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackCooldown, setFeedbackCooldown] = useState<number>(0);
  const cooldownTimerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackMessage.trim() || submittingFeedback || feedbackCooldown > 0) return;
    setSubmittingFeedback(true);
    setFeedbackError(null);
    const res = await submitFeedback(feedbackCategory, feedbackMessage, globalUser || userProfile.username);
    setSubmittingFeedback(false);

    if (res.success) {
      setFeedbackSentSuccess(true);
      setFeedbackMessage('');
      setFeedbackCooldown(30);
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = setInterval(() => {
        setFeedbackCooldown((prev) => {
          if (prev <= 1) {
            if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      setTimeout(() => setFeedbackSentSuccess(false), 5000);
    } else {
      setFeedbackError(res.error || 'Failed to submit feedback');
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#141418] border border-white/15 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 text-white max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)]">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Support & Feedback</h3>
              <p className="text-xs text-white/50">Official channels & direct developer feedback</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Official Social Links */}
        <div className="flex flex-col gap-2.5">
          <h4 className="font-bold text-xs uppercase tracking-wider text-white/50 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Official Socials</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <a
              href="https://www.instagram.com/mouziketna"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-md flex-shrink-0">
                  <Instagram className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-white group-hover:text-[var(--accent)] transition-colors truncate">
                    Instagram
                  </span>
                  <span className="text-[10px] font-mono text-white/50 truncate">@mouziketna</span>
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-white/30 group-hover:text-white transition-colors flex-shrink-0 ml-1" />
            </a>

            <a
              href="https://www.tiktok.com/@mouziketna.app"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-black border border-white/20 flex items-center justify-center text-white shadow-md flex-shrink-0">
                  <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.525 0h3.08c.012 1.636.667 3.12 1.77 4.215 1.104 1.096 2.597 1.745 4.225 1.755v3.132a8.88 8.88 0 0 1-5.995-2.316v8.423c0 4.14-3.36 7.5-7.5 7.5a7.502 7.502 0 0 1-7.5-7.5c0-4.14 3.36-7.5 7.5-7.5.42 0 .83.035 1.23.102V10.93a4.34 4.34 0 0 0-1.23-.18 4.368 4.368 0 0 0-4.368 4.368 4.368 4.368 0 0 0 4.368 4.368c2.41 0 4.368-1.958 4.368-4.368V0z"/>
                  </svg>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-white group-hover:text-[var(--accent)] transition-colors truncate">
                    TikTok
                  </span>
                  <span className="text-[10px] font-mono text-white/50 truncate">@mouziketna.app</span>
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-white/30 group-hover:text-white transition-colors flex-shrink-0 ml-1" />
            </a>
          </div>
        </div>

        {/* Report / Suggestion Form */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-3">
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-white/70 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Submit Report or Suggestion</span>
            </h4>
            <p className="text-[11px] text-white/50 mt-0.5">
              Send a direct message or bug report to the admin team.
            </p>
          </div>

          <form onSubmit={handleSendFeedback} className="flex flex-col gap-3">
            {/* Category Selector */}
            <div className="flex gap-2">
              {(['Report Problem', 'Suggestion'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFeedbackCategory(cat)}
                  className={`flex-1 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                    feedbackCategory === cat
                      ? 'bg-[var(--accent)] text-black border-[var(--accent)] shadow-md'
                      : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {cat === 'Report Problem' ? '🚨 Report Problem' : '💡 Suggestion'}
                </button>
              ))}
            </div>

            {/* Message Textarea */}
            <textarea
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              placeholder={
                feedbackCategory === 'Report Problem'
                  ? 'Describe the problem or error you experienced...'
                  : 'Describe your recommendation or new feature idea...'
              }
              rows={3}
              required
              className="w-full p-3 rounded-xl bg-black/50 border border-white/15 focus:border-[var(--accent)] text-white text-xs font-medium placeholder:text-white/30 focus:outline-none resize-none transition-colors"
            />

            {feedbackSentSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Thank you! Message sent to the admin inbox.</span>
              </div>
            )}

            {feedbackError && (
              <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{feedbackError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submittingFeedback || feedbackCooldown > 0 || !feedbackMessage.trim()}
              className="w-full py-2.5 rounded-xl bg-[var(--accent)] hover:brightness-110 active:scale-98 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submittingFeedback ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : feedbackCooldown > 0 ? (
                <span>Wait {feedbackCooldown}s to submit again</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Message</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
