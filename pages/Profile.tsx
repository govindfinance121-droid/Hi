import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { db, ref, onValue } from '../services/firebase';
import { UserRole } from '../types';

const Profile: React.FC = () => {
  const { user, logout, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  
  const [ffUid, setFfUid] = useState(user?.ff_uid || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [gender, setGender] = useState(user?.gender || 'Male');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  
  // Social Links
  const [insta, setInsta] = useState(user?.instagramLink || '');
  const [fb, setFb] = useState(user?.facebookLink || '');

  const [isDarkMode, setIsDarkMode] = useState(true);
  
  // Verification State
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [adminUpi, setAdminUpi] = useState('8284062117@upi');
  const [adminWhatsapp, setAdminWhatsapp] = useState('918284062117');
  const [referralTarget, setReferralTarget] = useState(10); 

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  // Badge Logic Helpers
  const isMaster = user?.uid === 'ADMIN_MASTER' || user?.email === 'admin@realesports.com';
  const isSubAdmin = user?.role === UserRole.SUB_ADMIN;

  const plans = [
    { id: 1, name: '10 Days Trial', price: 50, tier: 'BLUE', duration: '10 Days' },
    { id: 2, name: '20 Days Pack', price: 100, tier: 'BLUE', duration: '20 Days' },
    { id: 3, name: 'Monthly Blue', price: 99, tier: 'BLUE', duration: '1 Month' },
    { id: 4, name: 'Gold Premium', price: 199, tier: 'GOLD', duration: '1 Month' },
  ];

  useEffect(() => {
    // Check PWA status
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsAppInstalled(isStandalone);

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    if(user) {
        setFfUid(user.ff_uid || '');
        setBio(user.bio || '');
        setAvatarUrl(user.avatarUrl || '');
        setInsta(user.instagramLink || '');
        setFb(user.facebookLink || '');
    }
    
    if (db) {
        onValue(ref(db, 'settings'), (snap) => {
            const data = snap.val();
            if (data) {
                setAdminUpi(data.adminUpi || '8284062117@upi');
                setAdminWhatsapp(data.adminWhatsapp || '918284062117');
                if (data.referralTarget) setReferralTarget(data.referralTarget);
            }
        });
    }
  }, [user]);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setIsDarkMode(isDark);
  }, []);

  const handleInstallApp = async () => {
      if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === 'accepted') {
              setDeferredPrompt(null);
          }
      } else {
          alert("App is already installed or browser does not support installation.");
      }
  };

  const toggleDarkMode = () => {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  const handleSave = () => {
    updateProfile({ 
        ff_uid: ffUid, 
        bio, 
        gender: gender as any, 
        avatarUrl,
        instagramLink: insta,
        facebookLink: fb
    });
    setEditing(false);
  };

  const handlePayVerification = () => {
    if (!selectedPlan) return;
    const message = encodeURIComponent(
        `*VERIFICATION REQUEST*\n\nUser: ${user?.username}\nUID: ${user?.uid}\nPlan: ${selectedPlan.name} (₹${selectedPlan.price})\nTier: ${selectedPlan.tier}\n\nI have made the payment. Please verify my account.`
    );
    window.open(`https://wa.me/${adminWhatsapp}?text=${message}`, '_blank');
    setShowVerifyModal(false);
  };

  const copyRefCode = () => {
      if (user?.uid) {
          navigator.clipboard.writeText(user.uid);
          alert("Referral Code (UID) Copied!");
      }
  };

  const supportLinks = [
    { name: 'WhatsApp Help', icon: 'fa-whatsapp', color: 'text-green-500', link: `https://wa.me/${adminWhatsapp}` },
    { name: 'Rules & Terms', icon: 'fa-file-contract', color: 'text-gray-400', link: '/rules', internal: true },
  ];

  return (
    <div className="p-4 pt-8 pb-20 relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Profile</h1>
        <button onClick={toggleDarkMode} className="p-2 rounded-full bg-secondary border border-gray-700 text-yellow-500">
          <i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
        </button>
      </div>

      <div className="bg-secondary rounded-2xl p-6 text-center border border-gray-800 mb-6 relative overflow-hidden">
        {isMaster && (
            <div className="absolute inset-0 bg-gradient-to-b from-red-900/20 to-transparent pointer-events-none"></div>
        )}

        <div className={`w-24 h-24 bg-dark rounded-full mx-auto mb-4 p-1 overflow-hidden relative ${isMaster ? 'border-4 border-red-600 shadow-[0_0_20px_red]' : isSubAdmin ? 'border-4 border-blue-500 shadow-[0_0_15px_blue]' : user?.verificationTier === 'GOLD' ? 'border-4 border-yellow-400 shadow-[0_0_15px_gold]' : 'border-2 border-primary'}`}>
          {avatarUrl || user?.avatarUrl ? (
            <img src={avatarUrl || user?.avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-full" />
          ) : (
             <div className="w-full h-full bg-gray-700 rounded-full flex items-center justify-center text-3xl font-bold text-gray-500">
                {user?.username.charAt(0).toUpperCase()}
             </div>
          )}
        </div>
        
        <h2 className="text-xl font-bold text-white mb-1 flex items-center justify-center gap-1">
            {user?.username}
            {isMaster ? (
                <i className="fas fa-shield-alt text-red-600 drop-shadow-[0_0_5px_red]" title="Official Owner"></i>
            ) : isSubAdmin ? (
                <i className="fas fa-user-shield text-blue-500 drop-shadow-[0_0_5px_blue]" title="Official Admin"></i>
            ) : user?.isVerified && (
                <i className={`fas ${user.verificationTier === 'GOLD' ? 'fa-crown text-yellow-400 drop-shadow-[0_0_5px_gold]' : 'fa-check-circle text-blue-500'}`}></i>
            )}
        </h2>
        <p className="text-gray-400 text-xs mb-4">{user?.email}</p>
        
        {isMaster && (
            <div className="mb-6 animate-in zoom-in duration-500">
                <div className="bg-gradient-to-r from-red-900/40 to-black border border-red-600/50 p-3 rounded-xl inline-block relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent"></div>
                    <div className="flex items-center gap-3 justify-center mb-1">
                        <i className="fas fa-trophy text-yellow-400 text-xl drop-shadow-[0_0_5px_gold]"></i>
                        <i className="fas fa-medal text-yellow-400 text-xl drop-shadow-[0_0_5px_gold]"></i>
                        <i className="fas fa-star text-yellow-400 text-xl drop-shadow-[0_0_5px_gold]"></i>
                        <i className="fas fa-award text-yellow-400 text-xl drop-shadow-[0_0_5px_gold]"></i>
                    </div>
                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">OFFICIAL OWNER</span>
                </div>
            </div>
        )}

        {isSubAdmin && (
             <div className="mb-6 animate-in zoom-in duration-500">
                <div className="bg-gradient-to-r from-blue-900/40 to-black border border-blue-600/50 p-3 rounded-xl inline-block relative overflow-hidden">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">OFFICIAL ADMIN</span>
                </div>
             </div>
        )}

        {!isMaster && !isSubAdmin && (
            !user?.isVerified ? (
                <button onClick={() => setShowVerifyModal(true)} className="mb-4 text-xs font-bold bg-blue-600/20 text-blue-400 px-3 py-1 rounded border border-blue-500/50 hover:bg-blue-600 hover:text-white transition-colors">
                    Get Verified (Blue Tick) <i className="fas fa-arrow-right ml-1"></i>
                </button>
            ) : (
                <div className="mb-4 flex flex-col items-center gap-1">
                    <span className={`text-xs px-2 py-1 rounded border font-bold ${user.verificationTier === 'GOLD' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500' : 'bg-blue-500/10 text-blue-500 border-blue-500'}`}>
                        Verified Member ({user.verificationTier || 'BLUE'})
                    </span>
                    {user.verificationExpiry && (
                        <span className="text-[10px] text-gray-500">
                            Expires: {new Date(user.verificationExpiry).toLocaleDateString()}
                        </span>
                    )}
                </div>
            )
        )}

        <div className="grid grid-cols-2 gap-4 mb-4">
           <div className="bg-dark/50 p-2 rounded">
             <div className="text-[10px] text-gray-500 uppercase">Wallet</div>
             <div className="font-bold text-green-500">₹{user?.balance}</div>
           </div>
           <div className="bg-dark/50 p-2 rounded">
             <div className="text-[10px] text-gray-500 uppercase">Status</div>
             <div className="font-bold text-primary">{isMaster ? 'OWNER' : isSubAdmin ? 'ADMIN' : user?.role}</div>
           </div>
        </div>
        
        {!isMaster && !isSubAdmin && (
            <div className="bg-dark/40 border border-gray-700 p-3 rounded-xl mb-4 text-left">
                <div className="flex justify-between items-end mb-1">
                    <h3 className="text-xs font-bold text-gray-300">
                        {user?.verificationTier === 'GOLD' ? 'You are a Premium Agent' : 'Invite & Upgrade Badge'}
                    </h3>
                    <span className="text-[10px] text-blue-400">{user?.validReferralCount || 0} Valid Invites</span>
                </div>
                <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden mb-2">
                    <div className="bg-yellow-500 h-full transition-all duration-500" style={{ width: `${Math.min(((user?.validReferralCount || 0) / 10) * 100, 100)}%` }}></div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex-1 bg-black/30 p-2 rounded border border-gray-700/50 flex justify-between items-center cursor-pointer" onClick={copyRefCode}>
                        <span className="text-xs font-mono text-gray-400 truncate w-24">Code: {user?.uid}</span>
                        <i className="fas fa-copy text-gray-500 text-xs hover:text-white"></i>
                    </div>
                </div>
                <div className="mt-2 text-[10px] text-gray-400 space-y-1 bg-black/20 p-2 rounded">
                    <p className="flex justify-between"><span>• 1 Referral:</span> <span className="text-blue-400">+30 Days Blue Tick</span></p>
                    <p className="flex justify-between"><span>• 10 Referrals:</span> <span className="text-yellow-500 font-bold">GOLD BADGE (1 Year)</span></p>
                </div>
            </div>
        )}

        {(user?.instagramLink || user?.facebookLink) && !editing && (
            <div className="flex justify-center gap-4 mb-6">
                {user.instagramLink && (
                    <a href={user.instagramLink} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white hover:scale-110 transition-transform">
                        <i className="fab fa-instagram text-xl"></i>
                    </a>
                )}
                {user.facebookLink && (
                    <a href={user.facebookLink} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white hover:scale-110 transition-transform">
                        <i className="fab fa-facebook-f text-xl"></i>
                    </a>
                )}
            </div>
        )}

        <div className="space-y-3 text-left">
           <div className="bg-dark/50 p-3 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-[10px] text-gray-500 uppercase block">Free Fire UID</span>
                {editing ? (
                  <input type="text" value={ffUid} onChange={(e) => setFfUid(e.target.value)} className="bg-transparent border-b border-primary outline-none text-white w-full text-sm" placeholder="Enter UID" />
                ) : (
                  <span className="text-white font-mono text-sm">{user?.ff_uid || 'Not Set'}</span>
                )}
              </div>
           </div>

           {(editing || user?.bio) && (
             <div className="bg-dark/50 p-3 rounded-lg">
                <span className="text-[10px] text-gray-500 uppercase block">Bio</span>
                {editing ? (
                  <input type="text" value={bio} onChange={(e) => setBio(e.target.value)} className="bg-transparent border-b border-primary outline-none text-white w-full text-sm" />
                ) : (
                  <p className="text-sm italic text-gray-300">{user?.bio}</p>
                )}
             </div>
           )}

           {editing && (
             <>
                 <div className="bg-dark/50 p-3 rounded-lg">
                    <span className="text-[10px] text-gray-500 uppercase block">Instagram Link</span>
                    <input type="text" value={insta} onChange={(e) => setInsta(e.target.value)} className="bg-transparent border-b border-primary outline-none text-white w-full text-sm" placeholder="https://instagram.com/..." />
                 </div>
                 <div className="bg-dark/50 p-3 rounded-lg">
                    <span className="text-[10px] text-gray-500 uppercase block">Facebook Link</span>
                    <input type="text" value={fb} onChange={(e) => setFb(e.target.value)} className="bg-transparent border-b border-primary outline-none text-white w-full text-sm" placeholder="https://facebook.com/..." />
                 </div>
                 <div className="bg-dark/50 p-3 rounded-lg">
                    <span className="text-[10px] text-gray-500 uppercase block">Avatar Image Link</span>
                    <input type="text" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="bg-transparent border-b border-primary outline-none text-white w-full text-sm" placeholder="https://..." />
                 </div>
             </>
           )}
        </div>

        <button 
          onClick={() => editing ? handleSave() : setEditing(true)}
          className={`mt-4 w-full py-2 rounded-lg font-bold text-sm transition-colors ${editing ? 'bg-green-600 text-white' : 'bg-primary text-black'}`}
        >
          {editing ? 'SAVE CHANGES' : 'EDIT PROFILE'}
        </button>
      </div>

      <div className="bg-secondary rounded-xl p-4 border border-gray-800 mb-6">
        <h3 className="font-bold mb-4 text-sm uppercase tracking-wide text-gray-400">Support</h3>
        <div className="space-y-3">
          {/* INSTALL APP OPTION */}
          {!isAppInstalled && deferredPrompt && (
              <button 
                onClick={handleInstallApp}
                className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-green-600/20 to-green-600/10 border border-green-600/30 rounded-lg hover:bg-green-600/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <i className="fas fa-download text-xl text-green-500"></i>
                  <span className="text-sm font-bold text-green-400">Install App</span>
                </div>
                <i className="fas fa-chevron-right text-green-600 text-xs"></i>
              </button>
          )}

          {supportLinks.map((link) => (
            link.internal ? (
              <Link key={link.name} to={link.link} className="flex items-center justify-between p-3 bg-dark rounded-lg hover:bg-gray-800 transition-colors">
                <div className="flex items-center gap-3">
                  <i className={`fab ${link.icon} text-xl ${link.color}`}></i>
                  <span className="text-sm font-medium">{link.name}</span>
                </div>
                <i className="fas fa-chevron-right text-gray-600 text-xs"></i>
              </Link>
            ) : (
              <a key={link.name} href={link.link} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-dark rounded-lg hover:bg-gray-800 transition-colors">
                <div className="flex items-center gap-3">
                  <i className={`fab ${link.icon} text-xl ${link.color}`}></i>
                  <span className="text-sm font-medium">{link.name}</span>
                </div>
                <i className="fas fa-chevron-right text-gray-600 text-xs"></i>
              </a>
            )
          ))}
        </div>
      </div>

      <button onClick={logout} className="w-full bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white border border-red-600/50 font-bold py-3 rounded-xl transition-all">
        <i className="fas fa-sign-out-alt mr-2"></i> Logout
      </button>

      {/* VERIFICATION MODAL */}
      {showVerifyModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
           <div className="bg-secondary w-full max-w-sm rounded-2xl p-0 overflow-hidden border border-primary/30 shadow-2xl animate-in fade-in zoom-in duration-300">
               <div className="bg-gradient-to-r from-blue-900 to-blue-600 p-4 relative">
                   <h2 className="text-white font-bold text-lg flex items-center gap-2">
                       <i className="fas fa-check-circle"></i> Get Verified
                   </h2>
                   <button onClick={() => setShowVerifyModal(false)} className="absolute top-4 right-4 text-white/70 hover:text-white">
                       <i className="fas fa-times"></i>
                   </button>
               </div>
               
               <div className="p-4 max-h-[60vh] overflow-y-auto">
                   <p className="text-xs text-gray-300 mb-4">Choose a plan to get the Blue Tick or Gold Tick. Pay via UPI and send screenshot on WhatsApp.</p>
                   
                   <div className="space-y-2 mb-4">
                       {plans.map(plan => (
                           <div 
                             key={plan.id}
                             onClick={() => setSelectedPlan(plan)}
                             className={`p-3 rounded-lg border cursor-pointer flex justify-between items-center transition-all ${selectedPlan?.id === plan.id ? 'bg-primary/20 border-primary' : 'bg-dark border-gray-700 hover:border-gray-500'}`}
                           >
                               <div>
                                   <h3 className={`font-bold text-sm ${plan.tier === 'GOLD' ? 'text-yellow-400' : 'text-white'}`}>
                                       {plan.name} {plan.tier === 'GOLD' && <i className="fas fa-crown text-xs ml-1"></i>}
                                   </h3>
                                   <p className="text-[10px] text-gray-400">{plan.duration}</p>
                               </div>
                               <div className="font-bold text-lg">₹{plan.price}</div>
                           </div>
                       ))}
                   </div>

                   {selectedPlan && (
                       <div className="bg-dark p-3 rounded-lg border border-gray-700 mb-4">
                           <div className="text-center mb-2">
                               <span className="text-[10px] text-gray-500 uppercase">Scan to Pay</span>
                               <div className="bg-white p-2 w-32 h-32 mx-auto rounded mt-2 mb-2">
                                   <img src="https://i.supaimg.com/6deb7095-5292-4ad4-9b4f-bc33ad97cfd8.png" className="w-full h-full object-contain" />
                               </div>
                               <div className="font-mono text-white select-all text-xs">{adminUpi}</div>
                           </div>
                           <button onClick={handlePayVerification} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                               <i className="fab fa-whatsapp text-lg"></i> Pay & Send Screenshot
                           </button>
                       </div>
                   )}
               </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Profile;