import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Transaction } from '../types';
import { db, ref, onValue, push, update } from '../services/firebase';

const Wallet: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [tab, setTab] = useState<'ADD' | 'WITHDRAW' | 'HISTORY'>('ADD');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  
  // Dynamic Settings
  const [adminUpi, setAdminUpi] = useState('8284062117@upi');
  const [adminWhatsapp, setAdminWhatsapp] = useState('918284062117');
  const [minWithdraw, setMinWithdraw] = useState(50);
  const [depositMsg, setDepositMsg] = useState('Scan & Pay');
  const [qrCodeUrl, setQrCodeUrl] = useState('https://i.supaimg.com/6deb7095-5292-4ad4-9b4f-bc33ad97cfd8.png');

  useEffect(() => {
    if (db) {
        onValue(ref(db, 'settings'), (snap) => {
            const data = snap.val();
            if (data) {
                setAdminUpi(data.adminUpi || '8284062117@upi');
                setAdminWhatsapp(data.adminWhatsapp || '918284062117');
                setMinWithdraw(data.minWithdraw || 50);
                setDepositMsg(data.depositInstruction || 'Scan & Pay');
                if (data.qrCodeUrl) setQrCodeUrl(data.qrCodeUrl);
            }
        });
    }
  }, []);

  const handleWithdraw = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) < minWithdraw) {
      alert(`Minimum withdrawal is ₹${minWithdraw}`);
      return;
    }
    if (user && Number(amount) > user.balance) {
      alert("Insufficient balance");
      return;
    }
    if (!paymentMethod) {
      alert("Please enter payment details");
      return;
    }

    const withdrawAmount = Number(amount);
    const commission = withdrawAmount * 0.05; // 5% Commission
    const payableAmount = withdrawAmount - commission;

    const confirmMsg = `Withdrawal Summary:\n\nRequested: ₹${withdrawAmount}\nPlatform Fee (5%): -₹${commission}\nYou Receive: ₹${payableAmount}\n\nConfirm?`;

    if (window.confirm(confirmMsg)) {
        // 1. Deduct Balance
        updateProfile({ balance: user!.balance - withdrawAmount });
        
        // 2. Create Transaction Record (User View)
        if (db) {
            await push(ref(db, 'transactions'), {
                userId: user!.uid,
                type: 'WITHDRAW',
                amount: withdrawAmount,
                netAmount: payableAmount,
                timestamp: Date.now(),
                status: 'PENDING',
                description: `Withdraw Request (Fee: ₹${commission})`
            });

            // 3. Log Commission for Admin Stats
            await push(ref(db, 'transactions'), {
                userId: 'ADMIN',
                type: 'COMMISSION',
                amount: commission,
                timestamp: Date.now(),
                status: 'SUCCESS',
                description: `5% Fee from ${user?.username}`
            });
        }

        const message = encodeURIComponent(
            `*WITHDRAWAL REQUEST*\n\nUser: ${user?.username}\nUID: ${user?.uid}\n\nRequested: ₹${withdrawAmount}\nFee (5%): ₹${commission}\n*PAYABLE: ₹${payableAmount}*\n\n*To:* ${paymentMethod}`
        );
        window.open(`https://wa.me/${adminWhatsapp}?text=${message}`, '_blank');
        
        setAmount('');
        setPaymentMethod('');
    }
  };

  return (
    <div className="p-4 pt-8">
      {/* Balance Card */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-6 mb-8 border border-gray-700 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <i className="fas fa-wallet text-8xl"></i>
        </div>
        <p className="text-gray-400 text-sm font-medium mb-1">Total Balance</p>
        <h1 className="text-4xl font-bold text-white mb-4">₹{user?.balance.toFixed(2)}</h1>
        <div className="flex gap-3">
          <div className="bg-green-500/20 text-green-500 px-3 py-1 rounded text-xs font-bold">
            <i className="fas fa-arrow-up mr-1"></i> Deposit Active
          </div>
          <div className="bg-blue-500/20 text-blue-500 px-3 py-1 rounded text-xs font-bold">
            <i className="fas fa-shield-alt mr-1"></i> Secure
          </div>
        </div>
      </div>

      <div className="flex bg-secondary p-1 rounded-xl mb-6">
        {['ADD', 'WITHDRAW', 'HISTORY'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === t ? 'bg-primary text-black shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="bg-secondary rounded-xl p-6 border border-gray-800 min-h-[300px]">
        {tab === 'ADD' && (
          <div className="text-center">
            <h3 className="font-bold text-lg mb-4">Add Money</h3>
            <div className="bg-white p-2 w-52 h-52 mx-auto rounded-lg mb-4 flex items-center justify-center overflow-hidden">
              <img src={qrCodeUrl} alt="Payment QR" className="w-full h-full object-contain" />
            </div>
            <p className="text-sm text-gray-400 mb-4">{depositMsg}</p>
            <div className="bg-dark p-3 rounded text-sm font-mono text-primary mb-6 select-all">
              {adminUpi}
            </div>
            <button 
              onClick={() => window.open(`https://wa.me/${adminWhatsapp}?text=I have sent money to ${adminUpi}. My UID: ${user?.uid}`, '_blank')}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
            >
              <i className="fab fa-whatsapp text-xl"></i> Send Screenshot
            </button>
          </div>
        )}

        {tab === 'WITHDRAW' && (
          <div>
            <h3 className="font-bold text-lg mb-4">Withdraw Winnings</h3>
            <p className="text-gray-400 text-xs mb-6">Manual withdrawal via WhatsApp.</p>
            
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-400 mb-2">Amount (Min ₹{minWithdraw})</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white text-lg font-bold" placeholder="0" />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-400 mb-2">UPI ID / Paytm</label>
              <input type="text" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white" placeholder="e.g. 9876543210@paytm" />
            </div>

            <div className="bg-dark p-3 rounded border border-gray-700 mb-6">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Requested:</span>
                    <span>₹{amount || 0}</span>
                </div>
                <div className="flex justify-between text-xs text-red-400 mb-1">
                    <span>Platform Fee (5%):</span>
                    <span>-₹{Number(amount || 0) * 0.05}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-green-500 border-t border-gray-600 pt-1 mt-1">
                    <span>You Receive:</span>
                    <span>₹{Number(amount || 0) * 0.95}</span>
                </div>
            </div>

            <button onClick={handleWithdraw} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
              <i className="fab fa-whatsapp text-xl"></i> Request on WhatsApp
            </button>
          </div>
        )}

        {tab === 'HISTORY' && (
          <div className="text-center text-gray-500 py-10">
            <p>Transaction history will appear here once connected to live backend.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Wallet;