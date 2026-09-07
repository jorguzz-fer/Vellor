import React from 'react';
import { CreditCard, Truck, RefreshCw, Award } from 'lucide-react';

export const ValueProps: React.FC = () => {
  const props = [
    {
      icon: CreditCard,
      title: 'PAYMENT',
      subtitle: 'Bespoke Wire, Amex & Encrypted Escrow',
    },
    {
      icon: Truck,
      title: 'SHIPPING & DELIVERY',
      subtitle: 'Complimentary Insured Armored Courier',
    },
    {
      icon: RefreshCw,
      title: 'RETURNS & EXCHANGES',
      subtitle: '30-Day Hassle-Free Concierge Protocol',
    },
    {
      icon: Award,
      title: 'HIGH QUALITY',
      subtitle: 'Geneva Seal & 5-Year Global Warranty',
    },
  ];

  return (
    <section className="bg-[#0e1b1a] border-t border-b border-[#1c3836] py-10 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {props.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={index}
              className="flex flex-col items-center text-center group cursor-default"
            >
              <div className="w-12 h-12 rounded-full bg-[#132524] border border-[#234542] flex items-center justify-center mb-3 group-hover:border-[#c8a25c] transition-colors">
                <Icon className="w-5 h-5 text-[#c8a25c]" />
              </div>
              <h4 className="text-xs font-sans font-bold tracking-[0.2em] text-[#f4efe6] uppercase mb-1">
                {item.title}
              </h4>
              <p className="text-[11px] font-sans text-[#ede7dc]/60 tracking-wider">
                {item.subtitle}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
