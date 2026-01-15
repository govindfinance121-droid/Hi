import React, { useState, useEffect } from 'react';
import { Tournament, AppNotification } from '../types';
import { useAuth } from '../context/AuthContext';
import { db, ref, onValue, update, push, set } from '../services/firebase';

const Home: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [filter, setFilter] = useState<'ALL' | 'SOLO' | 'DUO' | 'SQUAD'>('ALL');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  
  // Notification State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasNewNotif, setHasNewNotif] = useState(false);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallHeader, setShowInstallHeader] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isStandalone) return;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallHeader(true);
    });
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallHeader(false);
    }
    setDeferredPrompt(null);
  };

  // Slider Data
  const slides = [
    { 
      id: 1, 
      image: 'https://picsum.photos/800/400?random=10', 
      title: 'Mega Squad Cup', 
      subtitle: 'Win Total Prize ₹5000' 
    },
    { 
      id: 2, 
      image: 'https://picsum.photos/800/400?random=20', 
      title: 'Solo Rush Hour', 
      subtitle: 'Double Kill Points This Weekend' 
    },
    { 
      id: 3, 
      image: 'https://picsum.photos/800/400?random=30', 
      title: 'New Map: Alpine', 
      subtitle: 'Explore and Conquer' 
    }
  ];

  // Slider Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [slides.length]);

  // Load Tournaments & Notifications
  useEffect(() => {
    if (db) {
       // Tournaments
       const tournRef = ref(db, 'tournaments');
       onValue(tournRef, (snap) => {
         const data = snap.val();
         if (data) {
            const list = Object.entries(data).map(([key, value]: [string, any]) => ({
                ...value,
                key
            })) as Tournament[];
            setTournaments(list.reverse()); // Newest first
         } else {
             setTournaments([]);
         }
       });

       // Notifications
       const notifRef = ref(db, 'notifications');
       onValue(notifRef, (snap) => {
         const data = snap.val();
         if (data) {
            const list = Object.values(data) as AppNotification[];
            const sortedList = list.sort((a,b) => b.timestamp - a.timestamp);
            setNotifications(sortedList);
            
            // CHECK LAST READ
            const lastRead = localStorage.getItem('lastReadNotifTime');
            if (sortedList.length > 0) {
                const latestTime = sortedList[0].timestamp;
                if (!lastRead || latestTime > Number(lastRead)) {
                    setHasNewNotif(true);
                }
            }
         }
       });
    }
  }, []);

  const handleOpenNotifications = () => {
      setShowNotifications(true);
      setHasNewNotif(false);
      // Save current latest timestamp as read
      if (notifications.length > 0) {
          localStorage.setItem('lastReadNotifTime', notifications[0].timestamp.toString());
      }
  };

  const handleJoin = async (tournament: Tournament) => {
    if (!user) return;
    
    if (!user.ff_uid) {
      alert("Please update your Free Fire UID in profile first!");
      return;
    }

    if (user.balance < tournament.entryFee) {
      alert("Insufficient Balance!");
      return;
    }

    if (!tournament.key) return;

    if (confirm(`Confirm join ${tournament.title} for ₹${tournament.entryFee}?`)) {
      setJoiningId(tournament.id);
      
      try {
          // 1. Deduct Balance
          const newBalance = user.balance - tournament.entryFee;
          updateProfile({ balance: newBalance });
          
          // 2. Add to Participants in Firebase
          await set(ref(db, `tournaments/${tournament.key}/participants/${user.uid}`), true);

          // 3. Update Filled Slots
          const newSlots = (tournament.filledSlots || 0) + 1;
          await update(ref(db, `tournaments/${tournament.key}`), { filledSlots: newSlots });

          // 4. Record Transaction
          await push(ref(db, 'transactions'), {
            userId: user.uid,
            type: 'JOIN_FEE',
            amount: -tournament.entryFee,
            timestamp: Date.now(),
            status: 'SUCCESS',
            description: `Joined: ${tournament.title}`
          });

          alert("Joined Successfully! Details will be visible when live.");
      } catch (e) {
          console.error(e);
          alert("Error joining match. Please try again.");
      } finally {
          setJoiningId(null);
      }
    }
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      alert("Copied!");
  };

  const filteredTournaments = tournaments.filter(t => 
    filter === 'ALL' ? true : t.type === filter
  );

  return (
    <div className="pb-8 relative">
      {/* Header with Notification and Install Button */}
      <div className="absolute top-0 left-0 right-0 z-30 p-4 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
         <div className="pointer-events-auto">
            <h1 className="font-bold text-xl text-primary drop-shadow-md">REAL ESPORTS</h1>
         </div>
         <div className="flex items-center gap-2 pointer-events-auto">
            {showInstallHeader && (
              <button 
                onClick={handleInstallClick}
                className="bg-green-600 text-white text-[10px] font-bold px-3 py-2 rounded-full shadow-lg animate-bounce flex items-center gap-1"
              >
                <i className="fas fa-download"></i> APP
              </button>
            )}
            <button 
              onClick={handleOpenNotifications}
              className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 relative text-white transition-transform active:scale-95"
            >
              <i className="fas fa-bell"></i>
              {hasNewNotif && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-black animate-pulse"></span>}
            </button>
         </div>
      </div>

      {/* Slider Section */}
      <div className="relative h-64 w-full overflow-hidden mb-4 group">
        {slides.map((slide, index) => (
          <div 
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <img 
              src={slide.image} 
              alt={slide.title} 
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-4 left-4 z-20">
              <span className="bg-primary text-black text-xs font-bold px-2 py-1 rounded mb-1 inline-block">FEATURED</span>
              <h2 className="text-2xl font-bold text-white shadow-black drop-shadow-md">{slide.title}</h2>
              <p className="text-gray-200 text-sm drop-shadow-md">{slide.subtitle}</p>
            </div>
          </div>
        ))}
        <div className="absolute bottom-4 right-4 z-20 flex gap-1">
          {slides.map((_, index) => (
            <div 
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                index === currentSlide ? 'bg-primary w-4' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 px-4 mb-6 overflow-x-auto hide-scrollbar">
        {['ALL', 'SOLO', 'DUO', 'SQUAD'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              filter === f 
                ? 'bg-primary text-black' 
                : 'bg-secondary text-gray-400 border border-gray-700'
            }`}
          >
            {f} MATCHES
          </button>
        ))}
      </div>

      {/* Live Status Bar */}
      <div className="px-4 mb-4">
        <div className="bg-secondary p-3 rounded-lg border border-gray-800 flex items-center justify-between">
           <div className="flex items-center gap-2">
             <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
             <span className="text-sm font-medium text-gray-300">Live Slots</span>
           </div>
           <span className="text-primary font-bold text-sm">Updated Just Now</span>
        </div>
      </div>

      {/* Tournament List */}
      <div className="px-4 space-y-4">
        {filteredTournaments.length === 0 ? (
            <div className="text-center text-gray-500 py-10">No Matches Available</div>
        ) : (
            filteredTournaments.map(tournament => {
              const isJoined = tournament.participants && user?.uid && tournament.participants[user.uid];
              const isFull = tournament.filledSlots >= tournament.maxSlots;

              return (
              <div key={tournament.id} className="bg-secondary rounded-xl overflow-hidden border border-gray-800 shadow-lg">
                <div className="h-32 w-full relative">
                   {tournament.image ? (
                     <img src={tournament.image} alt={tournament.title} className="w-full h-full object-cover" />
                   ) : (
                     <div className="w-full h-full bg-gray-700 flex items-center justify-center text-gray-500">No Image</div>
                   )}
                   <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold border border-white/10">
                     {tournament.status}
                   </div>
                   <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[10px] font-bold text-white border border-white/20">
                       <i className="fas fa-map-marked-alt mr-1"></i> {tournament.map}
                   </div>
                </div>
                
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-lg leading-tight mb-1">{tournament.title}</h3>
                      <p className="text-gray-400 text-xs flex items-center gap-1">
                        <i className="far fa-clock"></i> {tournament.date} at {tournament.time}
                      </p>
                    </div>
                    <div className="text-right">
                       <div className="text-xs text-gray-500 uppercase">Entry Fee</div>
                       <div className="text-primary font-bold text-lg">₹{tournament.entryFee}</div>
                    </div>
                  </div>

                  {isJoined ? (
                      tournament.roomId ? (
                        <div className="bg-blue-900/20 border border-blue-500/50 p-3 rounded-lg mb-4 text-center animate-in zoom-in duration-300">
                            <div className="text-xs text-blue-300 uppercase mb-2 font-bold flex items-center justify-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> 
                                Match Started
                            </div>
                            <div className="flex justify-center gap-4 mb-3">
                                <div className="text-left bg-dark/50 p-2 rounded w-1/2 border border-blue-500/30 cursor-pointer" onClick={() => copyToClipboard(tournament.roomId!)}>
                                    <span className="text-[10px] text-gray-400 block">Room ID</span>
                                    <span className="font-mono text-white font-bold text-lg select-all">{tournament.roomId}</span>
                                </div>
                                <div className="text-left bg-dark/50 p-2 rounded w-1/2 border border-blue-500/30 cursor-pointer" onClick={() => copyToClipboard(tournament.roomPass!)}>
                                    <span className="text-[10px] text-gray-400 block">Password</span>
                                    <span className="font-mono text-white font-bold text-lg select-all">{tournament.roomPass}</span>
                                </div>
                            </div>
                            <a 
                            href={tournament.gameLink || "intent://#Intent;scheme=freefiremobile;package=com.dts.freefireth;end"}
                            className="block w-full bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold py-3 rounded-lg shadow-lg hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                            >
                            <i className="fas fa-gamepad"></i> OPEN GAME
                            </a>
                        </div>
                      ) : (
                        <div className="bg-dark/50 p-3 rounded text-center mb-4 border border-dashed border-gray-700">
                            <i className="fas fa-check-circle text-green-500 mb-1"></i>
                            <p className="text-xs text-gray-300 font-bold">You have joined!</p>
                            <p className="text-[10px] text-gray-500">Room ID & Password will appear here 15 mins before match.</p>
                        </div>
                      )
                  ) : (
                     <div className="bg-dark/30 p-3 rounded text-center mb-4 border border-gray-800">
                        <i className="fas fa-lock text-gray-600 mb-1"></i>
                        <p className="text-xs text-gray-400 font-medium">Join Match to view Room ID & Password</p>
                     </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 bg-dark/50 p-3 rounded-lg mb-4">
                    <div className="text-center">
                      <div className="text-[10px] text-gray-500 uppercase">Prize Pool</div>
                      <div className="font-bold text-sm">₹{tournament.prizePool}</div>
                    </div>
                    <div className="text-center border-l border-gray-700">
                      <div className="text-[10px] text-gray-500 uppercase">Per Kill</div>
                      <div className="font-bold text-sm">₹{tournament.perKill}</div>
                    </div>
                    <div className="text-center border-l border-gray-700">
                      <div className="text-[10px] text-gray-500 uppercase">Type</div>
                      <div className="font-bold text-sm">{tournament.type}</div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mb-4">
                    <div className="w-full mr-4">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">Spots</span>
                        <span className="text-gray-200">{tournament.filledSlots}/{tournament.maxSlots}</span>
                      </div>
                      <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-primary h-full transition-all duration-500" 
                          style={{ width: `${(tournament.filledSlots / tournament.maxSlots) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {isJoined ? (
                       <button className="w-full py-3 rounded-lg font-bold text-sm bg-green-600/20 text-green-500 border border-green-600 cursor-default">
                           JOINED
                       </button>
                  ) : (
                    <button
                        disabled={tournament.status !== 'OPEN' || joiningId === tournament.id || isFull}
                        onClick={() => handleJoin(tournament)}
                        className={`w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wide transition-all ${
                        tournament.status === 'OPEN' && !isFull
                            ? 'bg-gradient-to-r from-primary to-orange-600 text-black hover:shadow-[0_0_15px_rgba(255,153,0,0.4)]'
                            : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        {joiningId === tournament.id ? (
                        <i className="fas fa-spinner fa-spin"></i>
                        ) : isFull ? (
                          'FULL'
                        ) : tournament.status === 'OPEN' ? (
                        'Join Now'
                        ) : (
                        tournament.status
                        )}
                    </button>
                  )}
                </div>
              </div>
              )
            })
        )}
      </div>

      {/* Notifications Drawer */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex justify-end">
           <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowNotifications(false)}></div>
           <div className="relative w-80 bg-secondary h-full border-l border-gray-800 p-4 shadow-2xl animate-in slide-in-from-right duration-300">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="font-bold text-lg">Notifications</h2>
                  <button onClick={() => setShowNotifications(false)} className="text-gray-400"><i className="fas fa-times"></i></button>
               </div>
               
               <div className="space-y-3 overflow-y-auto h-[calc(100vh-100px)]">
                  {notifications.length === 0 ? (
                     <p className="text-center text-gray-500 text-sm mt-10">No notifications yet.</p>
                  ) : (
                     notifications.map(n => (
                        <div key={n.id} className="bg-dark p-3 rounded-lg border border-gray-700 relative">
                           <h3 className="font-bold text-sm text-white">{n.title}</h3>
                           <p className="text-xs text-gray-400 mt-1">{n.message}</p>
                           <span className="text-[10px] text-gray-600 block mt-2 text-right">
                              {new Date(n.timestamp).toLocaleString()}
                           </span>
                        </div>
                     ))
                  )}
               </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Home;