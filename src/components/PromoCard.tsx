import React, { useState } from 'react';
import { Mail, X, CheckCircle2, Sparkles } from 'lucide-react';

interface PromoCardProps {
  onDismiss: () => void;
}

export const PromoCard: React.FC<PromoCardProps> = ({ onDismiss }) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [doNotShow, setDoNotShow] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
    }
  };

  return (
    <div className="col-span-1 md:col-span-2 relative bg-[#152a29] border border-[#1f3f3c] overflow-hidden flex flex-col sm:flex-row shadow-2xl rounded-sm min-h-[340px]">
      {/* Close button */}
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 z-20 text-[#ede7dc]/60 hover:text-[#ede7dc] transition-colors p-1 cursor-pointer"
        title="Dismiss Offer"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Left Column: Editorial Photo of Person with Green Jacket and Luxury Watch on Wrist */}
      <div className="w-full sm:w-1/2 relative min-h-[180px] sm:min-h-full overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=85"
          alt="Luxury Watch on Wrist"
          className="w-full h-full object-cover object-center transform hover:scale-105 transition-transform duration-700"
        />
        {/* Deep emerald overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t sm:bg-gradient-to-r from-transparent via-[#152a29]/30 to-[#152a29]" />
      </div>

      {/* Right Column: Promotional Form matching reference image */}
      <div className="w-full sm:w-1/2 p-6 sm:p-8 flex flex-col justify-center text-left bg-[#152a29]">
        {!submitted ? (
          <>
            <div className="inline-flex items-center gap-1.5 text-[#c8a25c] text-[10px] tracking-[0.25em] font-sans uppercase mb-2">
              <Sparkles className="w-3 h-3" />
              <span>Privilege Club</span>
            </div>

            {/* Headline from reference image */}
            <h3 
              className="text-xl sm:text-2xl font-serif font-normal text-[#f4efe6] tracking-[0.08em] leading-tight mb-4 uppercase"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              GET 30% OFF ON YOUR FIRST ORDER!
            </h3>

            <p className="text-xs text-[#ede7dc]/70 mb-5 leading-relaxed font-sans">
              Subscribe to the Vellor Private Gazette and receive immediate access to bespoke allocation timepieces and 30% welcome privilege.
            </p>

            {/* Email form with bottom border underline matching reference */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  required
                  className="w-full bg-transparent border-b border-[#325a56] focus:border-[#c8a25c] pb-2 text-xs text-[#ede7dc] placeholder-[#ede7dc]/40 outline-none pr-8 transition-colors font-sans"
                />
                <button
                  type="submit"
                  className="absolute right-0 top-1 text-[#ede7dc]/70 hover:text-[#c8a25c] transition-colors cursor-pointer"
                  title="Subscribe"
                >
                  <Mail className="w-4 h-4" />
                </button>
              </div>

              {/* Checkbox: "Do Not Show This Pop-up Again" */}
              <label className="flex items-center gap-2 cursor-pointer mt-1 select-none">
                <input
                  type="checkbox"
                  checked={doNotShow}
                  onChange={(e) => setDoNotShow(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-[#325a56] bg-transparent text-[#c8a25c] focus:ring-0 focus:ring-offset-0 accent-[#c8a25c]"
                />
                <span className="text-[11px] text-[#ede7dc]/60 font-sans tracking-wide">
                  Do Not Show This Pop-up Again
                </span>
              </label>

              <button
                type="submit"
                className="mt-1 py-2 px-4 bg-[#c8a25c] hover:bg-[#dfbe7d] text-[#0e1b1a] text-[10px] font-sans font-bold tracking-[0.2em] uppercase rounded-sm transition-colors cursor-pointer text-center"
              >
                CLAIM 30% PRIVILEGE
              </button>
            </form>
          </>
        ) : (
          <div className="py-6 flex flex-col items-center text-center animate-in fade-in duration-300">
            <CheckCircle2 className="w-10 h-10 text-[#c8a25c] mb-3" />
            <h4 className="text-lg font-serif uppercase tracking-wider text-[#f4efe6] mb-1">
              Welcome to Vellor
            </h4>
            <p className="text-xs text-[#ede7dc]/70 mb-3">
              Your exclusive code has been granted:
            </p>
            <div className="px-4 py-2 bg-[#0e1b1a] border border-[#c8a25c] rounded text-[#c8a25c] font-mono text-sm tracking-widest font-bold select-all">
              VELLOR-30-PRIVILEGE
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
