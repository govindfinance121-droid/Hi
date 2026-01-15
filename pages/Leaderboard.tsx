import React, { useState, useEffect } from 'react';
import { db, ref, onValue } from '../services/firebase';
import { UserProfile, Transaction, UserRole } from '../types';
import { useNavigate } from 'react-router-dom';

const Leaderboard: React.FC = () => {
  const [filter, setFilter] = useState<'TODAY' | 'WEEKLY' | 'LIFETIME'>('LIFETIME');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const navigate = useNavigate();

  // Helper Check
  const isUserMaster = (u: UserProfile) => u.uid === 'ADMIN_MASTER' || u.email === 'admin@realesports.com';
  const isUserSubAdmin = (u: UserProfile) => u.role === UserRole.SUB_ADMIN;

  useEffect(() => {
    if (!db) return;

    setLoading(true);
    
    // 1. Fetch Users
    const usersRef = ref(db, 'users');
    const transactionsRef = ref(db, 'transactions');

    onValue(usersRef, (userSnap) => {
        const userData = userSnap.val();
        if (!userData) return;

        onValue(transactionsRef, (txnSnap) => {
            const txnData = txnSnap.val();
            const allTxns: Transaction[] = txnData ? Object.values(txnData) : [];
            
            const userList = Object.values(userData).map((u: any) => {
                let score = 0;
                
                if (filter === 'LIFETIME') {
                    score = u.totalWinnings || 0;
                } else {
                    const now = new Date();
                    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                    const startOfWeek = startOfDay - (now.getDay() * 24 * 60 * 60 * 1000);

                    const timeLimit = filter === 'TODAY' ? startOfDay : startOfWeek;

                    const relevantTxns = allTxns.filter(t => 
                        t.userId === u.uid && 
                        t.type === 'WINNINGS' && 
                        t.timestamp >= timeLimit
                    );

                    score = relevantTxns.reduce((sum, t) => sum + Number(t.amount), 0);
                }

                return { ...u, score };
            });

            const sorted = userList.filter((u: any) => u.score > 0).sort((a: any, b: any) => b.score - a.score);
            setUsers(sorted);
            setLoading(false);
        });
    });

  }, [filter]);

  const handleMessage = (target: UserProfile) => {
      navigate('/community', { state: { targetUser: target } });
  };

  return (
    <div className="p-4 pt-8 pb-24">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <i className="fas fa-trophy"></i> Leaderboard
        </h1>
        <select 
          value={filter} 
          onChange={(e) => setFilter(e.target.value as any)}
          className="bg-secondary text-white text-xs p-2 rounded border border-gray-700 outline-none"
        >
            <option value="TODAY">Today's Winners</option>
            <option value="WEEKLY">This Week</option>
            <option value="LIFETIME">Lifetime Legends</option>
        </select>
      </div>

      {loading ? (
          <div className="text-center text-gray-500 mt-10">Loading ranks...</div>
      ) : users.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">
              <i className="fas fa-ghost text-4xl mb-2 opacity-50"></i>
              <p>No winners yet for this period.</p>
          </div>
      ) : (
          <div className="space-y-4">
              {/* TOP 3 PODIUM */}
              <div className="flex justify-center items-end gap-4 mb-8 mt-4">
                  {users[1] && (
                      <div className="flex flex-col items-center cursor-pointer" onClick={() => setSelectedUser(users[1])}>
                          <div className={`w-16 h-16 rounded-full p-1 mb-2 relative ${isUserMaster(users[1]) ? 'border-4 border-red-600' : isUserSubAdmin(users[1]) ? 'border-4 border-blue-400' : 'border-2 border-gray-400 bg-gray-800'}`}>
                              <img src={users[1].avatarUrl || `https://ui-avatars.com/api/?name=${users[1].username}&background=random`} className="w-full h-full rounded-full object-cover" />
                              <div className="absolute -bottom-2 w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center text-black font-bold text-xs border border-white">2</div>
                          </div>
                          <p className="text-xs font-bold w-20 text-center truncate">{users[1].username}</p>
                          <p className="text-primary font-bold text-sm">₹{users[1].score}</p>
                      </div>
                  )}
                  
                  {users[0] && (
                      <div className="flex flex-col items-center relative -top-4 cursor-pointer" onClick={() => setSelectedUser(users[0])}>
                          <i className={`fas fa-crown text-xl mb-1 animate-bounce ${isUserMaster(users[0]) ? 'text-red-500' : 'text-yellow-400'}`}></i>
                          <div className={`w-20 h-20 rounded-full p-1 mb-2 relative shadow-[0_0_20px_rgba(250,204,21,0.3)] ${isUserMaster(users[0]) ? 'border-4 border-red-600' : isUserSubAdmin(users[0]) ? 'border-4 border-blue-400' : 'border-4 border-yellow-400 bg-gray-800'}`}>
                              <img src={users[0].avatarUrl || `https://ui-avatars.com/api/?name=${users[0].username}&background=random`} className="w-full h-full rounded-full object-cover" />
                              <div className="absolute -bottom-2 w-7 h-7 bg-yellow-400 rounded-full flex items-center justify-center text-black font-bold text-sm border-2 border-white">1</div>
                          </div>
                          <p className="text-sm font-bold w-24 text-center truncate text-yellow-400">{users[0].username}</p>
                          <p className="text-primary font-bold text-lg">₹{users[0].score}</p>
                      </div>
                  )}

                  {users[2] && (
                      <div className="flex flex-col items-center cursor-pointer" onClick={() => setSelectedUser(users[2])}>
                          <div className={`w-16 h-16 rounded-full p-1 mb-2 relative ${isUserMaster(users[2]) ? 'border-4 border-red-600' : isUserSubAdmin(users[2]) ? 'border-4 border-blue-400' : 'border-2 border-orange-700 bg-gray-800'}`}>
                              <img src={users[2].avatarUrl || `https://ui-avatars.com/api/?name=${users[2].username}&background=random`} className="w-full h-full rounded-full object-cover" />
                              <div className="absolute -bottom-2 w-6 h-6 bg-orange-700 rounded-full flex items-center justify-center text-white font-bold text-xs border border-white">3</div>
                          </div>
                          <p className="text-xs font-bold w-20 text-center truncate">{users[2].username}</p>
                          <p className="text-primary font-bold text-sm">₹{users[2].score}</p>
                      </div>
                  )}
              </div>

              {/* REST OF LIST */}
              <div className="bg-secondary rounded-xl overflow-hidden border border-gray-800">
                  {users.slice(3).map((u, index) => (
                      <div key={u.uid} onClick={() => setSelectedUser(u)} className="flex items-center justify-between p-3 border-b border-gray-700 last:border-0 hover:bg-white/5 cursor-pointer">
                          <div className="flex items-center gap-3">
                              <span className="text-gray-500 font-bold w-6 text-center">{index + 4}</span>
                              <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden relative">
                                  <img src={u.avatarUrl || `https://ui-avatars.com/api/?name=${u.username}&background=random`} className="w-full h-full object-cover" />
                                  {isUserMaster(u) && <div className="absolute inset-0 border-2 border-red-500 rounded-full"></div>}
                              </div>
                              <p className="font-bold text-sm flex items-center gap-1">
                                  {u.username}
                                  {isUserMaster(u) ? <i className="fas fa-shield-alt text-red-500 text-[10px]"></i> : 
                                   isUserSubAdmin(u) ? <i className="fas fa-user-shield text-blue-500 text-[10px]"></i> : null}
                              </p>
                          </div>
                          <p className="text-primary font-bold text-sm">₹{u.score}</p>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* PUBLIC PROFILE MODAL */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-secondary w-full max-w-sm rounded-2xl p-6 border border-gray-700 relative overflow-hidden shadow-2xl">
              
              {/* OWNER BG EFFECT */}
              {isUserMaster(selectedUser) && (
                 <div className="absolute inset-0 bg-gradient-to-b from-red-900/30 to-transparent pointer-events-none"></div>
              )}
              
              <button onClick={() => setSelectedUser(null)} className="absolute top-3 right-3 text-gray-400 hover:text-white z-10">
                  <i className="fas fa-times text-xl"></i>
              </button>

              <div className="text-center mb-4 relative z-0">
                  <div className={`w-24 h-24 mx-auto mb-3 rounded-full p-1 ${isUserMaster(selectedUser) ? 'border-4 border-red-600 shadow-[0_0_20px_red]' : isUserSubAdmin(selectedUser) ? 'border-4 border-blue-500 shadow-[0_0_15px_blue]' : selectedUser.verificationTier === 'GOLD' ? 'border-4 border-yellow-400' : 'border-2 border-primary'}`}>
                      <img src={selectedUser.avatarUrl || `https://ui-avatars.com/api/?name=${selectedUser.username}&background=random`} className="w-full h-full rounded-full object-cover" />
                  </div>
                  <h2 className="text-xl font-bold flex items-center justify-center gap-1">
                      {selectedUser.username}
                      {isUserMaster(selectedUser) ? (
                          <i className="fas fa-shield-alt text-red-600 drop-shadow-[0_0_5px_red]" title="Official Owner"></i>
                      ) : isUserSubAdmin(selectedUser) ? (
                          <i className="fas fa-user-shield text-blue-500 drop-shadow-[0_0_5px_blue]" title="Official Admin"></i>
                      ) : selectedUser.isVerified && (
                          <i className={`fas ${selectedUser.verificationTier === 'GOLD' ? 'fa-crown text-yellow-400' : 'fa-check-circle text-blue-500'}`}></i>
                      )}
                  </h2>
                  <p className="text-xs text-gray-400 font-mono mt-1">{selectedUser.uid}</p>
              </div>

              {/* OWNER MEDALS */}
              {isUserMaster(selectedUser) && (
                  <div className="mb-5 text-center">
                      <div className="bg-gradient-to-r from-red-900/40 to-black border border-red-600/50 p-3 rounded-xl inline-block relative overflow-hidden">
                          <div className="flex items-center gap-3 justify-center mb-1">
                              <i className="fas fa-trophy text-yellow-400 text-lg drop-shadow-[0_0_5px_gold]"></i>
                              <i className="fas fa-medal text-yellow-400 text-lg drop-shadow-[0_0_5px_gold]"></i>
                              <i className="fas fa-star text-yellow-400 text-lg drop-shadow-[0_0_5px_gold]"></i>
                              <i className="fas fa-award text-yellow-400 text-lg drop-shadow-[0_0_5px_gold]"></i>
                          </div>
                          <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">OFFICIAL OWNER</span>
                      </div>
                  </div>
              )}

              {/* SUB ADMIN BADGE */}
              {isUserSubAdmin(selectedUser) && (
                  <div className="mb-5 text-center">
                      <div className="bg-gradient-to-r from-blue-900/40 to-black border border-blue-600/50 p-3 rounded-xl inline-block">
                          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">OFFICIAL ADMIN</span>
                      </div>
                  </div>
              )}

              {/* BIO */}
              {selectedUser.bio && (
                  <div className="bg-dark/50 p-3 rounded-xl mb-4 text-center border border-gray-800">
                      <p className="text-sm italic text-gray-300">"{selectedUser.bio}"</p>
                  </div>
              )}

              {/* SOCIAL LINKS */}
              {(selectedUser.instagramLink || selectedUser.facebookLink) && (
                  <div className="flex justify-center gap-4 mb-6">
                      {selectedUser.instagramLink && (
                          <a href={selectedUser.instagramLink} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white hover:scale-110 transition-transform">
                              <i className="fab fa-instagram text-xl"></i>
                          </a>
                      )}
                      {selectedUser.facebookLink && (
                          <a href={selectedUser.facebookLink} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white hover:scale-110 transition-transform">
                              <i className="fab fa-facebook-f text-xl"></i>
                          </a>
                      )}
                  </div>
              )}

              <button 
                onClick={() => handleMessage(selectedUser)}
                className="w-full bg-primary text-black font-bold py-3 rounded-xl hover:bg-white transition-colors"
              >
                  <i className="fas fa-comment-dots mr-2"></i> SEND MESSAGE
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;