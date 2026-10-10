import React from 'react';
import { ShieldAlert, Globe, Lock, AlertTriangle } from 'lucide-react';

interface GeoBlockScreenProps {
  message?: string;
  errorType?: string;
}

export const GeoBlockScreen: React.FC<GeoBlockScreenProps> = ({
  message = 'MOUZIKETNA is exclusively available within Tunisia. VPNs, proxies, and international traffic are strictly restricted.',
  errorType = 'geoblock_restricted',
}) => {
  return (
    <div className="fixed inset-0 z-[99999] bg-[#08080a] text-white flex flex-col items-center justify-center p-6 select-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,107,26,0.12)_0%,transparent_70%)] pointer-events-none" />
      
      <div className="relative max-w-md w-full bg-[#141418] border border-red-500/30 rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.9)] text-center flex flex-col items-center">
        <div className="w-20 h-20 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mb-6 shadow-[0_0_20px_rgba(251,44,54,0.3)] animate-pulse">
          <ShieldAlert className="w-10 h-10" />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider mb-3">
          <AlertTriangle className="w-3.5 h-3.5" />
          Access Restricted
        </div>

        <h1 className="text-2xl font-black tracking-tight text-white mb-3">
          Tunisia Geofence & VPN Block
        </h1>

        <p className="text-sm text-white/70 leading-relaxed mb-8">
          {message}
        </p>

        <div className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-left text-xs text-white/50 space-y-2 mb-6 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-white/40">Status:</span>
            <span className="text-red-400 font-bold uppercase">Blocked (403 Forbidden)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/40">Required ISO:</span>
            <span className="text-[#28c76f] font-bold">TN (Tunisia)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/40">Security Rule:</span>
            <span className="text-white/70">{errorType}</span>
          </div>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="w-full py-3 px-6 rounded-xl bg-white text-black font-extrabold text-sm hover:bg-white/90 active:scale-95 transition-all shadow-lg"
        >
          Retry Connection / Disable VPN
        </button>

        <p className="text-[11px] text-white/40 mt-4">
          Please disconnect your VPN, proxy, or data tunnel and connect from a valid Tunisian IP address.
        </p>
      </div>
    </div>
  );
};
