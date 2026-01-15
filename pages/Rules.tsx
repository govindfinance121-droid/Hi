import React from 'react';
import { Link } from 'react-router-dom';

const Rules: React.FC = () => {
  return (
    <div className="p-4 pt-8 pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/profile" className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-gray-400">
          <i className="fas fa-arrow-left"></i>
        </Link>
        <h1 className="text-2xl font-bold">Rules & Terms</h1>
      </div>

      <div className="space-y-6">
        <section className="bg-secondary p-5 rounded-xl border border-gray-800">
          <h2 className="text-primary font-bold mb-3 flex items-center gap-2">
            <i className="fas fa-gavel"></i> General Rules
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-gray-300">
            <li>Players must use their own Free Fire account.</li>
            <li>Use of hacks, scripts, or third-party tools is strictly prohibited and leads to a permanent ban.</li>
            <li>Respect other players in Community Chat. Abusive language is not tolerated.</li>
            <li>Teaming up with opponents in Solo/Duo matches is forbidden.</li>
          </ul>
        </section>

        <section className="bg-secondary p-5 rounded-xl border border-gray-800">
          <h2 className="text-primary font-bold mb-3 flex items-center gap-2">
            <i className="fas fa-wallet"></i> Payments & Withdrawals
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-gray-300">
            <li>Deposits are non-refundable once added to the wallet.</li>
            <li>Withdrawal requests are processed manually within 24 hours via WhatsApp verification.</li>
            <li>Minimum withdrawal amount is ₹50.</li>
            <li>Ensure your UPI ID/Phone number is correct before submitting a request.</li>
          </ul>
        </section>

        <section className="bg-secondary p-5 rounded-xl border border-gray-800">
          <h2 className="text-primary font-bold mb-3 flex items-center gap-2">
            <i className="fas fa-shield-alt"></i> Privacy Policy
          </h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            Your privacy is our priority. We do not share your email or phone number with other users.
            In the Community Chat, only your Username and Unique User ID are visible to others. 
            Audio calls are established securely without revealing personal contact details.
          </p>
        </section>
      </div>
    </div>
  );
};

export default Rules;