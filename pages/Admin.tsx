import React, { useState, useEffect } from 'react';
import { fileToBase64, db, ref, update, set, push, onValue, remove, get } from '../services/firebase';
import { AppSettings, UserProfile, Transaction, UserRole, Report, Tournament } from '../types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const { user, isMaster } = useAuth(); // isMaster tells if I am the Owner
  
  const [view, setView] = useState<'DASHBOARD' | 'EARNINGS' | 'CREATE_MATCH' | 'USERS' | 'NOTIFICATIONS' | 'SETTINGS' | 'REPORTS'>('DASHBOARD');
  
  // Dashboard Stats
  const [stats, setStats] = useState({ online: 0, totalUsers: 0, totalMatches: 0 });
  const [maintenance, setMaintenance] = useState(false);

  // Earnings Stats
  const [earnings, setEarnings] = useState({
      totalCommission: 0,
      totalDeposit: 0,
      totalWinningsDist: 0,
      netProfit: 0
  });
  const [earningsFilter, setEarningsFilter] = useState<'ALL' | 'TODAY' | 'MONTH'>('ALL');

  // User Management
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [balanceAdjust, setBalanceAdjust] = useState('');
  const [isWinnings, setIsWinnings] = useState(false); 
  const [verifyTier, setVerifyTier] = useState<'BLUE' | 'GOLD'>('BLUE');
  const [verifyDays, setVerifyDays] = useState(30);

  // Notification State
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMsg, setNotifMsg] = useState('');

  // Reports
  const [reports, setReports] = useState<Report[]>([]);

  // Settings
  const [settings, setSettings] = useState<AppSettings>({
    maintenanceMode: false,
    adminUpi: '8284062117@upi',
    adminWhatsapp: '918284062117',
    depositInstruction: 'Scan and pay.',
    withdrawInstruction: 'Manual Request',
    minWithdraw: 50,
    referralTarget: 10, // Default target for Gold
    qrCodeUrl: 'https://i.supaimg.com/6deb7095-5292-4ad4-9b4f-bc33ad97cfd8.png'
  });

  // Create/Edit Match State
  // Storing firebase Key in editingMatchKey instead of internal ID
  const [editingMatchKey, setEditingMatchKey] = useState<string | null>(null);
  
  const [matchData, setMatchData] = useState({
    title: '', entryFee: '', prizePool: '', perKill: '', type: 'SOLO', 
    map: 'BERMUDA', date: '', time: '', image: '', imageUrlInput: '',
    gameLink: 'intent://#Intent;scheme=freefiremobile;package=com.dts.freefireth;end'
  });

  // Match Management (Room ID)
  // Store local state for room inputs to allow typing before updating
  const [roomInputs, setRoomInputs] = useState<{[key: string]: {roomId: string, roomPass: string}}>({});

  const [matches, setMatches] = useState<Tournament[]>([]);

  // INITIAL DATA LOAD
  useEffect(() => {
    if (!db) return;

    // Load Settings
    onValue(ref(db, 'settings'), (snap) => {
      if(snap.val()) {
        setSettings(snap.val());
        setMaintenance(snap.val().maintenanceMode);
      }
    });

    // Load Matches - FIX: Map Keys correctly
    onValue(ref(db, 'tournaments'), (snap) => {
        const data = snap.val();
        if (data) {
            const matchList = Object.entries(data).map(([key, value]: [string, any]) => ({
                ...value,
                key: key // Store Firebase Key
            }));
            setMatches(matchList.reverse()); // Newest first
            
            // Init room inputs
            const inputs: any = {};
            matchList.forEach(m => {
                inputs[m.key] = { roomId: m.roomId || '', roomPass: m.roomPass || '' };
            });
            setRoomInputs(inputs);

        } else {
            setMatches([]);
        }
    });

    // Load Users & Stats
    onValue(ref(db, 'users'), (snap) => {
      const data = snap.val();
      if (data) {
        const userArray: UserProfile[] = Object.values(data);
        setUsers(userArray);
        
        const now = Date.now();
        const onlineCount = userArray.filter(u => u.lastActive && (now - u.lastActive < 300000)).length;
        setStats({
          online: onlineCount,
          totalUsers: userArray.length,
          totalMatches: matches.length 
        });
      }
    });

    // Load Earnings
    onValue(ref(db, 'transactions'), (snap) => {
        const data = snap.val();
        if (data) {
            const txns: Transaction[] = Object.values(data);
            calculateEarnings(txns);
        }
    });

    // Load Reports
    onValue(ref(db, 'reports'), (snap) => {
        const data = snap.val();
        if (data) {
            setReports(Object.values(data));
        } else {
            setReports([]);
        }
    });

  }, [earningsFilter, matches.length]); 

  const calculateEarnings = (txns: Transaction[]) => {
      let commission = 0;
      let deposits = 0;
      let winnings = 0;

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

      const timeLimit = earningsFilter === 'TODAY' ? startOfDay : 
                        earningsFilter === 'MONTH' ? startOfMonth : 0;

      txns.forEach(t => {
          if (t.timestamp >= timeLimit) {
              if (t.type === 'COMMISSION') commission += Number(t.amount);
              if (t.type === 'DEPOSIT') deposits += Number(t.amount); 
              if (t.type === 'WINNINGS') winnings += Number(t.amount);
          }
      });

      setEarnings({
          totalCommission: commission,
          totalDeposit: deposits,
          totalWinningsDist: winnings,
          netProfit: commission 
      });
  };

  // --- ACTIONS ---

  const toggleMaintenance = () => {
    if (!isMaster) return alert("Only Main Owner can toggle maintenance.");
    const newVal = !maintenance;
    setMaintenance(newVal);
    update(ref(db, 'settings'), { maintenanceMode: newVal });
  };

  const handleSaveSettings = () => {
    if (!isMaster) return alert("Only Main Owner can change settings.");
    update(ref(db, 'settings'), settings);
    alert('Settings Saved Live!');
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle || !notifMsg) return;
    
    await push(ref(db, 'notifications'), {
        id: Date.now().toString(),
        title: notifTitle,
        message: notifMsg,
        timestamp: Date.now()
    });
    
    alert('Notification Sent to All Users!');
    setNotifTitle('');
    setNotifMsg('');
  };

  // --- MATCH MANAGEMENT ---

  const handleCreateOrUpdateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Determine final image: Uploaded base64 OR URL input OR existing image
    const finalImage = matchData.imageUrlInput || matchData.image;

    const commonData = {
        title: matchData.title,
        entryFee: Number(matchData.entryFee),
        prizePool: Number(matchData.prizePool),
        perKill: Number(matchData.perKill),
        type: matchData.type,
        map: matchData.map,
        date: matchData.date,
        time: matchData.time,
        image: finalImage,
        gameLink: matchData.gameLink
    };

    if (editingMatchKey) {
        // UPDATE EXISTING USING KEY
        await update(ref(db, `tournaments/${editingMatchKey}`), commonData);
        alert('Match Updated Successfully!');
        setEditingMatchKey(null);
    } else {
        // CREATE NEW
        const newMatch = {
            ...commonData,
            id: Date.now().toString(),
            filledSlots: 0,
            maxSlots: matchData.type === 'SOLO' ? 48 : matchData.type === 'DUO' ? 24 : 12,
            status: 'OPEN',
            roomId: '',
            roomPass: '',
            participants: {}
        };
        await push(ref(db, 'tournaments'), newMatch);
        alert('Match Created!');
    }
    
    // Reset Form
    setMatchData({
        title: '', entryFee: '', prizePool: '', perKill: '', type: 'SOLO', 
        map: 'BERMUDA', date: '', time: '', image: '', imageUrlInput: '',
        gameLink: 'intent://#Intent;scheme=freefiremobile;package=com.dts.freefireth;end'
    });
  };

  const handleEditClick = (match: Tournament) => {
      setEditingMatchKey(match.key || null);
      setMatchData({
          title: match.title,
          entryFee: match.entryFee.toString(),
          prizePool: match.prizePool.toString(),
          perKill: match.perKill.toString(),
          type: match.type as any,
          map: match.map,
          date: match.date,
          time: match.time,
          image: match.image || '',
          imageUrlInput: match.image && match.image.startsWith('http') ? match.image : '',
          gameLink: match.gameLink || 'intent://#Intent;scheme=freefiremobile;package=com.dts.freefireth;end'
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteMatch = async (key: string) => {
      if (!key) {
          alert("Error: Match ID is missing.");
          return;
      }
      if (confirm("Are you sure you want to DELETE this match? This cannot be undone.")) {
          try {
              // DIRECT FIREBASE REMOVE ON THE KEY PATH
              await remove(ref(db, `tournaments/${key}`));
              alert("Match Deleted.");
          } catch (error) {
              alert("Error deleting match: " + error);
          }
      }
  };

  const handleDeleteAllMatches = async () => {
    if (!isMaster) return alert("Only Owner can delete all matches.");
    
    if (confirm("DANGER: Are you sure you want to DELETE ALL MATCHES? This will wipe the entire tournaments database.")) {
        try {
            // REMOVE ENTIRE NODE
            await remove(ref(db, 'tournaments'));
            alert("All Matches Deleted Successfully.");
            setMatches([]);
        } catch (error) {
            console.error(error);
            alert("Error: " + error);
        }
    }
  };

  const handleRoomInputChange = (key: string, field: 'roomId' | 'roomPass', val: string) => {
      setRoomInputs(prev => ({
          ...prev,
          [key]: {
              ...prev[key],
              [field]: val
          }
      }));
  };

  const handleUpdateRoomDetails = async (key: string) => {
      const data = roomInputs[key];
      if (!data) return;
      
      await update(ref(db, `tournaments/${key}`), { 
          roomId: data.roomId, 
          roomPass: data.roomPass 
      });
      alert(`Room Details Updated Live! Users can now see ID: ${data.roomId}`);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      setMatchData({ ...matchData, image: base64, imageUrlInput: '' }); // Clear URL input if file selected
    }
  };

  const handleMessageUser = () => {
    if (selectedUser) {
        navigate('/community', { state: { targetUser: selectedUser } });
    }
  };

  // --- WALLET & REFERRAL LOGIC ---
  const handleUpdateBalance = async (action: 'ADD' | 'CUT') => {
    if (!selectedUser || !balanceAdjust) return;
    const amount = Number(balanceAdjust);
    const newBalance = action === 'ADD' 
      ? selectedUser.balance + amount 
      : selectedUser.balance - amount;
    
    const updates: any = { balance: newBalance };
    
    // Handle Winnings
    if (action === 'ADD' && isWinnings) {
        updates.totalWinnings = (selectedUser.totalWinnings || 0) + amount;
    }

    // --- REFERRAL LOGIC START ---
    // If admin ADDS money (Deposit), check if it's the user's first time
    if (action === 'ADD' && !selectedUser.hasDeposited && !isWinnings) {
        updates.hasDeposited = true; // Mark user as "Deposited"
        
        // If this user was referred by someone
        if (selectedUser.referredBy) {
            const referrerRef = ref(db, `users/${selectedUser.referredBy}`);
            
            // Get Referrer Data
            get(referrerRef).then(async (snap) => {
                if (snap.exists()) {
                    const referrerData = snap.val();
                    const currentValidRefs = referrerData.validReferralCount || 0;
                    const newValidRefs = currentValidRefs + 1;
                    
                    const referrerUpdates: any = { validReferralCount: newValidRefs };
                    
                    // REWARD LOGIC: 
                    // 1 Ref = 30 Days. 2 Refs = 60 Days... 
                    // 10 Refs = 1 Year Gold.

                    let currentExpiry = referrerData.verificationExpiry || Date.now();
                    // If expired, start from now
                    if (currentExpiry < Date.now()) currentExpiry = Date.now();

                    if (newValidRefs === 10) {
                        // GRAND PRIZE: 10 REFERRALS
                        referrerUpdates.isVerified = true;
                        referrerUpdates.verificationStatus = 'APPROVED';
                        referrerUpdates.verificationTier = 'GOLD';
                        // Add 1 Year (12 months)
                        referrerUpdates.verificationExpiry = Date.now() + (365 * 24 * 60 * 60 * 1000);
                        
                        // Notify
                        await push(ref(db, 'notifications'), {
                           id: Date.now().toString(),
                           title: "🌟 GOLD BADGE UNLOCKED! 🌟",
                           message: `Congratulations! You referred 10 verified users. You have received the GOLD Premium Badge for 1 Year!`,
                           timestamp: Date.now()
                        });

                    } else if (newValidRefs < 10) {
                        // NORMAL REWARD: +30 Days per referral
                        referrerUpdates.isVerified = true;
                        referrerUpdates.verificationStatus = 'APPROVED';
                        referrerUpdates.verificationTier = 'BLUE'; // Keep/Set Blue
                        
                        // Add 30 Days to current expiry
                        referrerUpdates.verificationExpiry = currentExpiry + (30 * 24 * 60 * 60 * 1000);

                         // Notify
                         await push(ref(db, 'notifications'), {
                            id: Date.now().toString(),
                            title: "Referral Bonus!",
                            message: `Referral #${newValidRefs} successful! You got +30 Days of Blue Tick verification.`,
                            timestamp: Date.now()
                         });
                    }

                    await update(referrerRef, referrerUpdates);
                }
            });
        }
    }
    // --- REFERRAL LOGIC END ---

    await update(ref(db, `users/${selectedUser.uid}`), updates);
    
    await push(ref(db, 'transactions'), {
        userId: selectedUser.uid,
        type: isWinnings && action === 'ADD' ? 'WINNINGS' : 'ADMIN_ADJUSTMENT',
        amount: amount,
        description: isWinnings ? 'Match Winnings' : `Admin ${action} Money`,
        timestamp: Date.now(),
        status: 'SUCCESS'
    });

    setBalanceAdjust('');
    setIsWinnings(false);
    alert(`Balance updated successfully.`);
  };

  const toggleVerifyUser = async () => {
    if (!selectedUser) return;
    
    if (selectedUser.isVerified) {
        await update(ref(db, `users/${selectedUser.uid}`), { 
          isVerified: false,
          verificationStatus: 'NONE',
          verificationTier: null,
          verificationExpiry: null
        });
        alert("Verification Revoked.");
        return;
    }

    const expiryDate = Date.now() + (verifyDays * 24 * 60 * 60 * 1000);

    await update(ref(db, `users/${selectedUser.uid}`), { 
      isVerified: true,
      verificationStatus: 'APPROVED',
      verificationTier: verifyTier,
      verificationExpiry: expiryDate
    });
    alert(`User Verified: ${verifyTier} for ${verifyDays} days.`);
  };

  const toggleOfficialAdmin = async () => {
    if (!isMaster) return alert("Only the Main Owner can grant/revoke Admin Status.");
    if (!selectedUser) return;

    if (selectedUser.uid === 'ADMIN_MASTER') return; // Cannot change master

    const isCurrentlySubAdmin = selectedUser.role === UserRole.SUB_ADMIN;
    const newRole = isCurrentlySubAdmin ? UserRole.USER : UserRole.SUB_ADMIN;

    await update(ref(db, `users/${selectedUser.uid}`), { 
        role: newRole
    });
    
    alert(newRole === UserRole.SUB_ADMIN ? "User is now an Official Admin!" : "Official Admin Access Revoked.");
    setSelectedUser({...selectedUser, role: newRole});
  };

  const toggleBlockUser = async () => {
      if(!selectedUser) return;
      // Cannot block Master
      if (selectedUser.uid === 'ADMIN_MASTER') return alert("Cannot block Owner");
      
      const newStatus = !selectedUser.isBlocked;
      await update(ref(db, `users/${selectedUser.uid}`), { isBlocked: newStatus });
      alert(newStatus ? "User Banned!" : "User Unbanned.");
      setSelectedUser({...selectedUser, isBlocked: newStatus});
  };

  const filteredUsers = users.filter(u => 
    u.username?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 pt-8 pb-24">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-primary">Admin Control</h1>
        <button 
          onClick={toggleMaintenance}
          className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1 ${maintenance ? 'bg-red-600 animate-pulse' : 'bg-green-600'}`}
        >
          <i className="fas fa-power-off"></i> {maintenance ? 'APP OFF' : 'APP ON'}
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto mb-6 hide-scrollbar">
        {['DASHBOARD', 'EARNINGS', 'CREATE_MATCH', 'USERS', 'REPORTS', 'NOTIFICATIONS', 'SETTINGS'].map(t => (
          <button 
            key={t}
            onClick={() => setView(t as any)}
            className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap relative ${view === t ? 'bg-white text-black' : 'bg-secondary'}`}
          >
            {t.replace('_', ' ')}
            {/* Reports Badge */}
            {t === 'REPORTS' && reports.length > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full animate-pulse border border-black"></span>
            )}
          </button>
        ))}
      </div>

      {/* --- DASHBOARD --- */}
      {view === 'DASHBOARD' && (
        <div className="grid grid-cols-2 gap-4">
           <div className="bg-secondary p-4 rounded-xl border border-gray-700">
             <h3 className="text-green-500 text-xs uppercase font-bold">Online Users</h3>
             <p className="text-3xl font-bold">{stats.online}</p>
             <i className="fas fa-circle text-[10px] text-green-500 animate-pulse"></i> Live
           </div>
           <div className="bg-secondary p-4 rounded-xl border border-gray-700">
             <h3 className="text-gray-400 text-xs uppercase">Total Users</h3>
             <p className="text-3xl font-bold">{stats.totalUsers}</p>
           </div>
           <div className="bg-secondary p-4 rounded-xl border border-gray-700 col-span-2">
             <h3 className="text-primary text-sm uppercase font-bold mb-2">Quick Shortcuts</h3>
             <div className="grid grid-cols-2 gap-2">
                 <button onClick={() => setView('CREATE_MATCH')} className="bg-dark p-3 rounded border border-gray-600 text-xs font-bold">Manage Matches</button>
                 <button onClick={() => setView('USERS')} className="bg-dark p-3 rounded border border-gray-600 text-xs font-bold">Manage Users</button>
             </div>
           </div>
        </div>
      )}

      {/* --- EARNINGS --- */}
      {view === 'EARNINGS' && (
          isMaster ? (
          <div className="space-y-4">
              <div className="flex justify-end gap-2 mb-4">
                  {['TODAY', 'MONTH', 'ALL'].map(f => (
                      <button 
                        key={f}
                        onClick={() => setEarningsFilter(f as any)}
                        className={`px-3 py-1 rounded text-xs font-bold ${earningsFilter === f ? 'bg-primary text-black' : 'bg-gray-700'}`}
                      >
                          {f}
                      </button>
                  ))}
              </div>
              <div className="bg-gradient-to-r from-green-900 to-green-700 p-6 rounded-xl border border-green-500">
                  <h3 className="text-green-300 text-xs uppercase font-bold mb-1">Total Net Profit</h3>
                  <p className="text-4xl font-bold">₹{earnings.netProfit.toFixed(2)}</p>
                  <p className="text-xs text-green-200 opacity-70">Mainly from 5% Withdrawal Commissions</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="bg-secondary p-4 rounded-xl border border-gray-700">
                      <h3 className="text-gray-400 text-xs uppercase">Commissions</h3>
                      <p className="text-2xl font-bold text-yellow-500">₹{earnings.totalCommission.toFixed(2)}</p>
                  </div>
                  <div className="bg-secondary p-4 rounded-xl border border-gray-700">
                      <h3 className="text-gray-400 text-xs uppercase">Prizes Given</h3>
                      <p className="text-2xl font-bold text-blue-400">₹{earnings.totalWinningsDist.toFixed(2)}</p>
                  </div>
              </div>
          </div>
          ) : <div className="p-4 text-center text-gray-500">Only Owner can view Earnings.</div>
      )}

      {/* --- REPORTS --- */}
      {view === 'REPORTS' && (
          <div className="space-y-4">
             <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                 User Reports
                 {reports.length > 0 && <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">{reports.length} New</span>}
             </h3>
             {reports.length === 0 ? (
                 <p className="text-gray-500">No pending reports.</p>
             ) : (
                 reports.map(rep => (
                     <div key={rep.id} className="bg-secondary p-4 rounded-xl border border-gray-700 relative">
                         <div className="flex justify-between items-start mb-2">
                             <div>
                                 <span className="text-xs text-red-400 font-bold uppercase">Reported User</span>
                                 <h4 className="text-white font-bold">{rep.reportedUserName} <span className="text-[10px] text-gray-500">({rep.reportedUserId})</span></h4>
                             </div>
                             <div className="text-right">
                                 <span className="text-xs text-blue-400 font-bold uppercase">Reporter</span>
                                 <h4 className="text-white text-sm">{rep.reporterName}</h4>
                             </div>
                         </div>
                         <div className="bg-dark p-2 rounded mb-2">
                             <p className="text-xs text-gray-400">Reason:</p>
                             <p className="text-sm italic">"{rep.reason}"</p>
                         </div>
                         <div className="flex gap-2">
                             <button onClick={async () => {
                                 const userToBanRef = ref(db, `users/${rep.reportedUserId}`);
                                 await update(userToBanRef, { isBlocked: true });
                                 await remove(ref(db, `reports/${rep.id}`));
                                 alert("User Banned & Report Resolved");
                             }} className="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold">BAN USER</button>
                             <button onClick={async () => {
                                 await remove(ref(db, `reports/${rep.id}`));
                                 alert("Report Ignored/Resolved");
                             }} className="bg-gray-600 text-white px-3 py-1 rounded text-xs font-bold">IGNORE</button>
                         </div>
                         <span className="text-[10px] text-gray-600 absolute bottom-2 right-2">{new Date(rep.timestamp).toLocaleString()}</span>
                     </div>
                 ))
             )}
          </div>
      )}

      {/* --- NOTIFICATIONS --- */}
      {view === 'NOTIFICATIONS' && (
         <div className="bg-secondary p-4 rounded-xl border border-gray-700">
             <h3 className="font-bold text-lg mb-4">Send Real-time Notification</h3>
             <form onSubmit={handleSendNotification} className="space-y-4">
                 <div>
                   <label className="text-xs text-gray-400">Title</label>
                   <input className="w-full bg-dark p-2 rounded text-white" value={notifTitle} onChange={e => setNotifTitle(e.target.value)} required placeholder="e.g. New Match Added!" />
                 </div>
                 <div>
                   <label className="text-xs text-gray-400">Message</label>
                   <textarea className="w-full bg-dark p-2 rounded text-white" value={notifMsg} onChange={e => setNotifMsg(e.target.value)} required rows={3} placeholder="Type your message here..." />
                 </div>
                 <button type="submit" className="w-full bg-primary text-black font-bold py-3 rounded">SEND ALERT</button>
             </form>
         </div>
      )}

      {/* --- USERS --- */}
      {view === 'USERS' && (
        <div>
          <input 
            type="text" 
            placeholder="Search username or email..." 
            className="w-full bg-secondary p-3 rounded-lg border border-gray-700 mb-4 text-sm outline-none focus:border-primary"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          
          <div className="space-y-3">
             {filteredUsers.map(u => {
               const isMasterUser = u.uid === 'ADMIN_MASTER' || u.email === 'admin@realesports.com';
               const isSubAdmin = u.role === UserRole.SUB_ADMIN;

               return (
               <div key={u.uid} className="bg-secondary p-3 rounded-xl border border-gray-700 flex justify-between items-center">
                 <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-gray-500 relative border ${isMasterUser ? 'border-red-500' : isSubAdmin ? 'border-blue-400' : 'border-gray-600'}`}>
                      {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full rounded-full object-cover"/> : u.username[0]}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm flex items-center gap-1">
                          {u.username}
                          {isMasterUser ? <i className="fas fa-shield-alt text-red-500 text-[10px]" title="Owner"></i> : 
                           isSubAdmin ? <i className="fas fa-user-shield text-blue-500 text-[10px]" title="Admin"></i> : null}
                          {u.isBlocked && <span className="text-[10px] bg-red-600 text-white px-1 rounded ml-1">BANNED</span>}
                      </h4>
                      <p className="text-[10px] text-gray-400">Bal: ₹{u.balance} | Valid Refs: <span className="text-green-500">{u.validReferralCount || 0}</span></p>
                    </div>
                 </div>
                 <button onClick={() => setSelectedUser(u)} className="bg-dark px-3 py-1 rounded text-xs text-primary font-bold border border-primary/30">MANAGE</button>
               </div>
             )})}
          </div>

          {selectedUser && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
               <div className="bg-secondary w-full max-w-sm rounded-2xl p-6 border border-gray-700 overflow-y-auto max-h-[90vh]">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-xl font-bold">{selectedUser.username}</h2>
                    <button onClick={() => setSelectedUser(null)} className="text-gray-400"><i className="fas fa-times"></i></button>
                  </div>

                  {/* MESSAGE USER BUTTON */}
                  <button onClick={handleMessageUser} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold text-sm mb-4 flex items-center justify-center gap-2">
                      <i className="fas fa-comment-dots"></i> Message User
                  </button>

                  {/* OFFICIAL ADMIN BADGE CONTROL (ONLY MASTER CAN SEE) */}
                  {isMaster && selectedUser.uid !== 'ADMIN_MASTER' && (
                      <button 
                         onClick={toggleOfficialAdmin}
                         className={`w-full py-3 rounded-lg font-bold text-sm mb-4 border ${selectedUser.role === UserRole.SUB_ADMIN ? 'bg-blue-900/20 text-blue-500 border-blue-500' : 'bg-gray-700 text-gray-300 border-gray-500'}`}
                      >
                         <i className="fas fa-user-shield mr-2"></i>
                         {selectedUser.role === UserRole.SUB_ADMIN ? 'REVOKE OFFICIAL ADMIN' : 'MAKE OFFICIAL ADMIN'}
                      </button>
                  )}
                  
                  {/* WALLET ACTIONS */}
                  <div className="mb-6 bg-dark/50 p-3 rounded">
                    <p className="text-xs text-gray-400 uppercase mb-2">Wallet Action</p>
                    <div className="flex gap-2 mb-2">
                       <input type="number" value={balanceAdjust} onChange={e => setBalanceAdjust(e.target.value)} className="flex-1 bg-dark p-2 rounded border border-gray-600 text-white" placeholder="Amount" />
                    </div>
                    <label className="flex items-center gap-2 mb-3 text-xs">
                        <input type="checkbox" checked={isWinnings} onChange={e => setIsWinnings(e.target.checked)} />
                        Mark as Match Winnings (Updates Leaderboard)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                       <button onClick={() => handleUpdateBalance('ADD')} className="bg-green-600 py-2 rounded font-bold text-xs">ADD (+)</button>
                       <button onClick={() => handleUpdateBalance('CUT')} className="bg-red-600 py-2 rounded font-bold text-xs">CUT (-)</button>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2 italic">
                        *Note: Adding money (non-winnings) for the first time will count as a "Valid Deposit" for the person who referred this user.
                    </p>
                  </div>
                  
                  {/* VERIFICATION ACTIONS */}
                  <div className="mb-6 border-t border-gray-700 pt-4">
                     <p className="text-xs text-gray-400 uppercase mb-2">Verification Control</p>
                     
                     {!selectedUser.isVerified ? (
                       <>
                         <div className="flex gap-2 mb-3">
                            <select 
                              value={verifyTier} 
                              onChange={(e) => setVerifyTier(e.target.value as 'BLUE' | 'GOLD')}
                              className="bg-dark text-xs p-2 rounded border border-gray-600 flex-1 text-white"
                            >
                                <option value="BLUE">BLUE (Standard)</option>
                                <option value="GOLD">GOLD (Premium)</option>
                            </select>
                            
                            <div className="flex items-center gap-2 bg-dark border border-gray-600 rounded px-2">
                                <input 
                                   type="number" 
                                   value={verifyDays} 
                                   onChange={e => setVerifyDays(Number(e.target.value))} 
                                   className="w-12 bg-transparent text-white text-xs outline-none text-center" 
                                />
                                <span className="text-[10px] text-gray-400">Days</span>
                            </div>
                         </div>
                         <button onClick={toggleVerifyUser} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded font-bold text-xs">
                             GRANT VERIFICATION
                         </button>
                       </>
                     ) : (
                       <div className="bg-blue-900/30 border border-blue-500/30 p-3 rounded">
                           <div className="flex justify-between items-center mb-2">
                               <span className="text-xs font-bold text-blue-300">Active: {selectedUser.verificationTier}</span>
                               <span className="text-[10px] text-gray-400">
                                   Expires: {selectedUser.verificationExpiry ? new Date(selectedUser.verificationExpiry).toLocaleDateString() : 'Never'}
                               </span>
                           </div>
                           <button onClick={toggleVerifyUser} className="w-full bg-red-900/50 text-red-400 border border-red-500/30 py-2 rounded font-bold text-xs">
                               REVOKE VERIFICATION
                           </button>
                       </div>
                     )}
                  </div>

                  <button onClick={toggleBlockUser} className={`w-full border py-3 rounded-lg font-bold text-sm ${selectedUser.isBlocked ? 'bg-green-600/20 text-green-500 border-green-600' : 'bg-red-900/20 text-red-500 border-red-600/30'}`}>
                      {selectedUser.isBlocked ? 'UNBAN USER' : 'BAN USER'}
                  </button>
               </div>
            </div>
          )}
        </div>
      )}

      {/* --- SETTINGS --- */}
      {view === 'SETTINGS' && (
          isMaster ? (
        <div className="space-y-4 pb-10">
           {/* PAYMENT SETTINGS */}
           <div className="bg-secondary p-4 rounded-xl border border-gray-700">
              <h3 className="font-bold text-sm mb-4 border-b border-gray-700 pb-2">Payment Configuration</h3>
              <div className="space-y-3">
                 <div>
                   <label className="text-xs text-gray-400">Admin UPI ID</label>
                   <input className="w-full bg-dark p-2 rounded text-white text-sm" value={settings.adminUpi} onChange={e => setSettings({...settings, adminUpi: e.target.value})} placeholder="e.g. name@upi" />
                 </div>
                 <div>
                   <label className="text-xs text-gray-400">QR Code Image URL</label>
                   <input className="w-full bg-dark p-2 rounded text-white text-sm" value={settings.qrCodeUrl || ''} onChange={e => setSettings({...settings, qrCodeUrl: e.target.value})} placeholder="Direct link to QR image" />
                   {settings.qrCodeUrl && (
                       <div className="mt-2 w-20 h-20 bg-white p-1 rounded">
                           <img src={settings.qrCodeUrl} className="w-full h-full object-contain" />
                       </div>
                   )}
                 </div>
                 <div>
                   <label className="text-xs text-gray-400">Min Withdraw (₹)</label>
                   <input type="number" className="w-full bg-dark p-2 rounded text-white text-sm" value={settings.minWithdraw} onChange={e => setSettings({...settings, minWithdraw: Number(e.target.value)})} />
                 </div>
              </div>
           </div>
           
           {/* REFERRAL SETTINGS */}
           <div className="bg-secondary p-4 rounded-xl border border-gray-700">
              <h3 className="font-bold text-sm mb-4 border-b border-gray-700 pb-2">Referral Program</h3>
              <div className="space-y-3">
                 <div>
                   <label className="text-xs text-gray-400">Referrals needed for GOLD Badge</label>
                   <input type="number" className="w-full bg-dark p-2 rounded text-white text-sm" value={settings.referralTarget} onChange={e => setSettings({...settings, referralTarget: Number(e.target.value)})} />
                   <p className="text-[10px] text-gray-500 mt-1">Users will get Blue Tick for every referral, and GOLD at this target.</p>
                 </div>
              </div>
           </div>

           {/* CONTACT SETTINGS */}
           <div className="bg-secondary p-4 rounded-xl border border-gray-700">
              <h3 className="font-bold text-sm mb-4 border-b border-gray-700 pb-2">Support & Contact</h3>
              <div className="space-y-3">
                 <div>
                   <label className="text-xs text-gray-400">WhatsApp Number (with Country Code)</label>
                   <input className="w-full bg-dark p-2 rounded text-white text-sm" value={settings.adminWhatsapp} onChange={e => setSettings({...settings, adminWhatsapp: e.target.value})} placeholder="919876543210" />
                 </div>
                 <div>
                   <label className="text-xs text-gray-400">Deposit Instructions</label>
                   <textarea className="w-full bg-dark p-2 rounded text-white text-sm" rows={2} value={settings.depositInstruction} onChange={e => setSettings({...settings, depositInstruction: e.target.value})} />
                 </div>
              </div>
           </div>

           <button onClick={handleSaveSettings} className="w-full bg-primary text-black font-bold py-3 rounded-xl shadow-lg shadow-primary/20 hover:bg-orange-600 transition-colors">
             SAVE ALL SETTINGS
           </button>
        </div>
          ) : <div className="p-4 text-center text-gray-500 border border-red-900/50 bg-red-900/10 rounded-xl">
               <i className="fas fa-lock text-2xl mb-2 text-red-500"></i>
               <p>Access Denied.</p>
               <p className="text-xs">Only the Master Owner can modify App Settings.</p>
            </div>
      )}

      {/* --- CREATE / MANAGE MATCH --- */}
      {view === 'CREATE_MATCH' && (
        <div className="space-y-6">
           {/* DELETE ALL BUTTON FOR MASTER */}
           {isMaster && (
               <div className="bg-red-900/20 border border-red-700 p-4 rounded-xl flex justify-between items-center mb-4">
                   <div>
                       <h3 className="font-bold text-red-500 text-sm">Reset Tournaments</h3>
                       <p className="text-xs text-gray-400">Delete ALL matches permanently.</p>
                   </div>
                   <button onClick={handleDeleteAllMatches} className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-4 py-2 rounded shadow-[0_0_10px_red]">
                       DELETE ALL MATCHES
                   </button>
               </div>
           )}

           <form onSubmit={handleCreateOrUpdateMatch} className="bg-secondary p-4 rounded-xl border border-gray-700 space-y-4">
              <div className="flex justify-between items-center border-b border-gray-700 pb-2 mb-2">
                  <h3 className="font-bold">{editingMatchKey ? 'Edit Match' : 'Create New Match'}</h3>
                  {editingMatchKey && <button onClick={() => { setEditingMatchKey(null); setMatchData({...matchData, title: ''}); }} className="text-xs text-red-400">Cancel Edit</button>}
              </div>
              
              <div><label className="text-xs text-gray-400">Match Title</label><input className="w-full bg-dark p-2 rounded text-white" value={matchData.title} onChange={e => setMatchData({...matchData, title: e.target.value})} required placeholder="e.g. Morning Rush Squad" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-gray-400">Entry Fee (₹)</label><input type="number" className="w-full bg-dark p-2 rounded text-white" value={matchData.entryFee} onChange={e => setMatchData({...matchData, entryFee: e.target.value})} required /></div>
                <div><label className="text-xs text-gray-400">Prize Pool (₹)</label><input type="number" className="w-full bg-dark p-2 rounded text-white" value={matchData.prizePool} onChange={e => setMatchData({...matchData, prizePool: e.target.value})} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-gray-400">Per Kill (₹)</label><input type="number" className="w-full bg-dark p-2 rounded text-white" value={matchData.perKill} onChange={e => setMatchData({...matchData, perKill: e.target.value})} required /></div>
                <div>
                    <label className="text-xs text-gray-400">Type</label>
                    <select className="w-full bg-dark p-2 rounded text-white text-sm" value={matchData.type} onChange={e => setMatchData({...matchData, type: e.target.value as any})}>
                        <option value="SOLO">SOLO</option>
                        <option value="DUO">DUO</option>
                        <option value="SQUAD">SQUAD</option>
                    </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs text-gray-400">Map</label>
                    <select className="w-full bg-dark p-2 rounded text-white text-sm" value={matchData.map} onChange={e => setMatchData({...matchData, map: e.target.value})}>
                        <option value="BERMUDA">BERMUDA</option>
                        <option value="PURGATORY">PURGATORY</option>
                        <option value="ALPINE">ALPINE</option>
                        <option value="KALAHARI">KALAHARI</option>
                        <option value="NEXTERRA">NEXTERRA</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs text-gray-400">Time</label>
                    <input type="time" className="w-full bg-dark p-2 rounded text-white" value={matchData.time} onChange={e => setMatchData({...matchData, time: e.target.value})} required />
                </div>
              </div>
              <div>
                  <label className="text-xs text-gray-400">Date</label>
                  <input type="date" className="w-full bg-dark p-2 rounded text-white" value={matchData.date} onChange={e => setMatchData({...matchData, date: e.target.value})} required />
              </div>
              
              {/* Image Logic */}
              <div>
                  <label className="text-xs text-gray-400 mb-1 block">Cover Image (Upload OR URL)</label>
                  <div className="flex flex-col gap-2">
                      <input type="text" placeholder="Paste Image URL here..." value={matchData.imageUrlInput} onChange={(e) => setMatchData({...matchData, imageUrlInput: e.target.value, image: ''})} className="w-full bg-dark p-2 rounded text-white text-xs" />
                      <div className="text-center text-xs text-gray-500">- OR -</div>
                      <input type="file" onChange={handleImageUpload} className="w-full text-xs text-gray-400" />
                  </div>
                  {(matchData.image || matchData.imageUrlInput) && (
                      <div className="mt-2 h-20 w-full bg-dark rounded overflow-hidden">
                          <img src={matchData.imageUrlInput || matchData.image} className="w-full h-full object-cover" />
                      </div>
                  )}
              </div>

              {/* Game Link */}
              <div>
                  <label className="text-xs text-gray-400 mb-1 block">Game Open Link (Deep Link)</label>
                  <input 
                    type="text" 
                    placeholder="Leave empty for default Free Fire MAX" 
                    value={matchData.gameLink} 
                    onChange={e => setMatchData({...matchData, gameLink: e.target.value})}
                    className="w-full bg-dark p-2 rounded text-white text-xs"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Default: intent://#Intent;scheme=freefiremobile;package=com.dts.freefireth;end</p>
              </div>
              
              <button type="submit" className={`w-full font-bold py-3 rounded ${editingMatchKey ? 'bg-blue-600 text-white' : 'bg-primary text-black'}`}>
                  {editingMatchKey ? 'UPDATE MATCH' : 'PUBLISH MATCH'}
              </button>
           </form>

           {/* MANAGE EXISTING MATCHES */}
           <div className="bg-secondary p-4 rounded-xl border border-gray-700">
               <h3 className="font-bold text-sm mb-4 border-b border-gray-700 pb-2">Active Matches Control (Room ID)</h3>
               {matches.length === 0 ? (
                   <div className="text-center text-gray-500 py-4">No matches found.</div>
               ) : (
                   <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                       {matches.map((m: Tournament) => (
                           <div key={m.key} className="bg-dark p-3 rounded-lg border border-gray-600 relative">
                               <div className="flex justify-between items-start mb-2">
                                   <div>
                                       <h4 className="font-bold text-white text-sm">{m.title}</h4>
                                       <p className="text-[10px] text-gray-400">{m.date} | {m.time} | {m.map}</p>
                                   </div>
                                   <div className="flex gap-2">
                                       <button onClick={() => handleEditClick(m)} className="bg-blue-900/30 text-blue-400 border border-blue-500/30 px-2 py-1 rounded text-[10px] hover:bg-blue-900/50">
                                           <i className="fas fa-edit"></i> Edit
                                       </button>
                                       <button onClick={() => handleDeleteMatch(m.key!)} className="bg-red-900/30 text-red-400 border border-red-500/30 px-2 py-1 rounded text-[10px] hover:bg-red-900/50">
                                           <i className="fas fa-trash"></i>
                                       </button>
                                   </div>
                               </div>

                               {/* ROOM ID INPUTS */}
                               <div className="bg-secondary/50 p-2 rounded mt-2 border border-gray-700/50">
                                   <div className="flex items-center gap-2 mb-2">
                                       <div className="flex-1">
                                           <label className="text-[10px] text-gray-500 block">Room ID</label>
                                           <input 
                                             value={roomInputs[m.key!]?.roomId || ''} 
                                             onChange={(e) => handleRoomInputChange(m.key!, 'roomId', e.target.value)}
                                             className="w-full bg-dark text-white text-xs p-1.5 rounded border border-gray-600 focus:border-green-500 outline-none font-mono"
                                             placeholder="Enter ID to go Live"
                                           />
                                       </div>
                                       <div className="flex-1">
                                           <label className="text-[10px] text-gray-500 block">Password</label>
                                           <input 
                                             value={roomInputs[m.key!]?.roomPass || ''} 
                                             onChange={(e) => handleRoomInputChange(m.key!, 'roomPass', e.target.value)}
                                             className="w-full bg-dark text-white text-xs p-1.5 rounded border border-gray-600 focus:border-green-500 outline-none font-mono"
                                             placeholder="Enter Pass"
                                           />
                                       </div>
                                   </div>
                                   <button 
                                     onClick={() => handleUpdateRoomDetails(m.key!)}
                                     className="w-full bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-2 rounded"
                                   >
                                       UPDATE DETAILS
                                   </button>
                                   <p className="text-[10px] text-green-500 italic mt-1 text-center">
                                       <i className="fas fa-info-circle mr-1"></i> 
                                       Updates are live instantly. Users can ONLY see this if they joined.
                                   </p>
                               </div>
                           </div>
                       ))}
                   </div>
               )}
           </div>
        </div>
      )}
    </div>
  );
};

export default Admin;