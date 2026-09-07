import React, { useState } from 'react';
import { X, MapPin, Phone, Mail, Clock, Calendar, CheckCircle2 } from 'lucide-react';

interface BoutiqueModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedWatchName?: string;
}

const BOUTIQUES = [
  {
    city: 'Geneva',
    country: 'Switzerland',
    address: 'Rue du Rhône 42, 1204 Genève',
    phone: '+41 22 819 90 00',
    hours: 'Mon - Sat: 10:00 - 18:30',
    status: 'Flagship Atelier',
  },
  {
    city: 'Zurich',
    country: 'Switzerland',
    address: 'Bahnhofstrasse 28, 8001 Zürich',
    phone: '+41 44 211 45 00',
    hours: 'Mon - Sat: 09:30 - 19:00',
    status: 'Private Salon',
  },
  {
    city: 'Paris',
    country: 'France',
    address: 'Place Vendôme 12, 75001 Paris',
    phone: '+33 1 42 68 00 20',
    hours: 'Mon - Sat: 10:30 - 19:30',
    status: 'Haute Horlogerie Salon',
  },
  {
    city: 'London',
    country: 'United Kingdom',
    address: '14 New Bond Street, Mayfair, London W1S 3SX',
    phone: '+44 20 7493 8888',
    hours: 'Mon - Sat: 10:00 - 18:00',
    status: 'Mayfair House',
  },
  {
    city: 'New York',
    country: 'United States',
    address: '745 Fifth Avenue, New York, NY 10151',
    phone: '+1 212 752 4000',
    hours: 'Mon - Sat: 10:00 - 18:00',
    status: 'Fifth Avenue Gallery',
  },
  {
    city: 'São Paulo',
    country: 'Brazil',
    address: 'Rua Oscar Freire 920, Jardins, São Paulo - SP',
    phone: '+55 11 3088 1200',
    hours: 'Seg - Sáb: 10:00 - 20:00',
    status: 'Boutique Exclusiva Jardins',
  },
  {
    city: 'Dubai',
    country: 'United Arab Emirates',
    address: 'Fashion Avenue, The Dubai Mall, Downtown Dubai',
    phone: '+971 4 362 7500',
    hours: 'Every day: 10:00 - 23:00',
    status: 'Vellor Grand Salon',
  },
];

export const BoutiqueModal: React.FC<BoutiqueModalProps> = ({
  isOpen,
  onClose,
  selectedWatchName,
}) => {
  const [selectedBoutiqueIndex, setSelectedBoutiqueIndex] = useState(0);
  const [booked, setBooked] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    date: '2026-09-15',
    time: '14:00',
    notes: selectedWatchName ? `Private viewing of ${selectedWatchName}` : '',
  });

  if (!isOpen) return null;

  const currentBoutique = BOUTIQUES[selectedBoutiqueIndex];

  const handleBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setBooked(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#091212]/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#132524] border border-[#234542] rounded-sm shadow-2xl p-6 text-[#ede7dc]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b border-[#1c3836] pb-4 mb-6">
          <div>
            <span className="text-[10px] font-sans tracking-[0.25em] text-[#c8a25c] uppercase">
              Global Presence · Vellor Concierge
            </span>
            <h2 
              className="text-2xl font-serif tracking-wider uppercase text-[#f4efe6] mt-0.5"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              Vellor Boutiques & Private Viewing
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#ede7dc]/60 hover:text-[#ede7dc] rounded cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Boutique List */}
          <div>
            <h3 className="text-xs font-sans tracking-widest text-[#ede7dc]/60 uppercase mb-3">
              Select an International Salon:
            </h3>
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {BOUTIQUES.map((b, idx) => (
                <div
                  key={b.city}
                  onClick={() => setSelectedBoutiqueIndex(idx)}
                  className={`p-3 rounded-sm border transition-all cursor-pointer ${
                    selectedBoutiqueIndex === idx
                      ? 'bg-[#182e2c] border-[#c8a25c] shadow-md'
                      : 'bg-[#0e1b1a] border-[#1c3836] hover:border-[#2a4d49]'
                  }`}
                >
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-sm font-serif tracking-wide text-[#f4efe6] font-semibold">
                      {b.city}, {b.country}
                    </span>
                    <span className="text-[9px] font-sans tracking-wider uppercase px-2 py-0.5 rounded bg-[#102020] text-[#c8a25c] border border-[#22403d]">
                      {b.status}
                    </span>
                  </div>

                  <p className="text-xs text-[#ede7dc]/70 flex items-center gap-1.5 mt-1">
                    <MapPin className="w-3 h-3 text-[#c8a25c] shrink-0" />
                    <span>{b.address}</span>
                  </p>

                  <div className="flex items-center gap-4 text-[11px] text-[#ede7dc]/50 mt-2">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-[#ede7dc]/40" />
                      {b.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#ede7dc]/40" />
                      {b.hours}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Appointment Form */}
          <div className="bg-[#0e1b1a] border border-[#1c3836] p-5 rounded-sm flex flex-col justify-between">
            {!booked ? (
              <form onSubmit={handleBooking} className="space-y-3.5">
                <div className="border-b border-[#1c3836] pb-3">
                  <h4 className="text-sm font-sans tracking-wider font-semibold uppercase text-[#f4efe6]">
                    Reserve Private Salon Appointment
                  </h4>
                  <p className="text-[11px] text-[#c8a25c] mt-0.5">
                    Location: {currentBoutique.city} ({currentBoutique.status})
                  </p>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#ede7dc]/60 block mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Lord / Lady / Mr. / Ms. Alexander Wright"
                    className="w-full bg-[#132524] border border-[#234542] rounded-sm px-3 py-2 text-xs text-[#ede7dc] outline-none focus:border-[#c8a25c]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#ede7dc]/60 block mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="alexander@domain.com"
                      className="w-full bg-[#132524] border border-[#234542] rounded-sm px-3 py-2 text-xs text-[#ede7dc] outline-none focus:border-[#c8a25c]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#ede7dc]/60 block mb-1">
                      Direct Telephone
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+1 (555) 019-2834"
                      className="w-full bg-[#132524] border border-[#234542] rounded-sm px-3 py-2 text-xs text-[#ede7dc] outline-none focus:border-[#c8a25c]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#ede7dc]/60 block mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full bg-[#132524] border border-[#234542] rounded-sm px-3 py-2 text-xs text-[#ede7dc] outline-none focus:border-[#c8a25c]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#ede7dc]/60 block mb-1">
                      Preferred Hour
                    </label>
                    <select
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      className="w-full bg-[#132524] border border-[#234542] rounded-sm px-3 py-2 text-xs text-[#ede7dc] outline-none focus:border-[#c8a25c]"
                    >
                      <option value="11:00">11:00 AM</option>
                      <option value="14:00">02:00 PM</option>
                      <option value="16:00">04:00 PM</option>
                      <option value="18:00">06:00 PM</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#ede7dc]/60 block mb-1">
                    Timepiece of Interest / Bespoke Requests
                  </label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g. Viewing Titanium Precision or Gold Editions"
                    className="w-full bg-[#132524] border border-[#234542] rounded-sm px-3 py-2 text-xs text-[#ede7dc] outline-none focus:border-[#c8a25c]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#c8a25c] hover:bg-[#dfbe7d] text-[#0e1b1a] text-xs font-sans font-bold tracking-[0.2em] uppercase rounded-sm transition-colors cursor-pointer mt-2"
                >
                  CONFIRM VIP CONCIERGE APPOINTMENT
                </button>
              </form>
            ) : (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <CheckCircle2 className="w-12 h-12 text-[#c8a25c] mb-3" />
                <h4 className="text-lg font-serif tracking-wider uppercase text-[#f4efe6] mb-1">
                  Appointment Confirmed
                </h4>
                <p className="text-xs text-[#ede7dc]/80 max-w-sm mb-4 leading-relaxed">
                  Our private client concierge will welcome you at <strong>{currentBoutique.city}</strong> on {formData.date} at {formData.time}. A champagne reception and private horologist have been reserved.
                </p>
                <button
                  onClick={() => setBooked(false)}
                  className="text-xs text-[#c8a25c] hover:underline"
                >
                  Book another session
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
