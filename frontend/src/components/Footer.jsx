import React from 'react';
import { ShoppingBag } from 'lucide-react';

const COLUMNS = [
  {
    title: 'ShopGenie',
    links: ['About', 'AI Shopping Assistant', 'Careers'],
  },
  {
    title: 'Shop',
    links: ['Products', 'Deals', 'Orders'],
  },
  {
    title: 'Support',
    links: ['Help Center', 'Contact Us', 'Shipping & Returns'],
  },
  {
    title: 'Legal',
    links: ['Privacy Policy', 'Terms & Conditions'],
  },
];

export default function Footer() {
  return (
    <footer className="w-full bg-white border-t border-sand mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-forest-500 flex items-center justify-center">
                <ShoppingBag className="h-4 w-4 text-white" strokeWidth={2.25} />
              </div>
              <span className="font-display font-semibold text-lg text-ink">ShopGenie</span>
            </div>
            <p className="text-sm text-inkMuted leading-relaxed max-w-[200px]">
              Shopping made smarter with an AI assistant that finds, compares, and helps you decide.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title} className="space-y-3">
              <h4 className="text-sm font-medium text-ink">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-inkMuted hover:text-forest-600 transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 tear-divider flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-inkMuted">© 2026 ShopGenie. All rights reserved.</p>
          <p className="text-xs text-inkMuted">Payments secured by Razorpay</p>
        </div>
      </div>
    </footer>
  );
}
