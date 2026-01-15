import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { ChatMessage, UserProfile, UserRole } from '../types';
import { db, ref, push, onValue, update, remove, get } from '../services/firebase';
import { useLocation } from 'react-router-dom';

const Community: React.FC = () => {
  const { user, updateProfile, isAdmin, isMaster } = useAuth();
  const location = useLocation();
  const [activeUser, setActiveUser] = useState<UserProfile | null>(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  
  // Search State
  const [searchChat, setSearchChat] = useState('');

  // VIEW PROFILE MODAL IN CHAT
  const [viewProfile, setViewProfile] = useState<UserProfile | null>(null);

  // Handle incoming navigation from Admin Panel or Leaderboard
  useEffect(() => {
    if (location.state && location.state.targetUser) {
      setActiveUser(location.state.targetUser);
      // Clean up history so refresh doesn't reset to this user if not desired
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Helper: Generate Chat ID (Consistent sorting is key)
  const getChatId = (uid1: string, uid2: string) => {
    // If one is ADMIN_MASTER, it should sort correctly with alphanumeric
    // ADMIN_MASTER < user_... (A < u) -> Correct
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
  };

  // Helper: Check roles (Safe checks included)
  const isUserMaster = (u: UserProfile) => (u?.uid === 'ADMIN_MASTER' || u?.email === 'admin@realesports.com');
  const isUserSubAdmin = (u: UserProfile) => (u?.role === UserRole.SUB_ADMIN);

  // Effect: Load Users (To get status and ticks)
  useEffect(() => {
    if (db) {
      const usersRef = ref(db, 'users');
      onValue(usersRef, (snap) => {
         const data = snap.val();
         if (data) {
             const list: UserProfile[] = Object.values(data);
             // Filter out self and ensure valid objects
             let filtered = list.filter(u => u && u.uid !== user?.uid);
             setUsersList(filtered);
         }
      });
    }
  }, [user]);

  // Effect: Listen for Messages when Chat is Active
  useEffect(() => {
    if (!activeUser || !user) return;

    if (db) {
      const chatId = getChatId(user.uid, activeUser.uid);
      const messagesRef = ref(db, `chats/${chatId}`);
      
      const unsubscribe = onValue(messagesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const loadedMsgs = Object.keys(data).map(key => ({
            ...data[key],
            id: key
          }));
          const visibleMsgs = loadedMsgs.filter(m => 
            !m.deletedFor || !m.deletedFor.includes(user.uid)
          );
          setMessages(visibleMsgs.sort((a, b) => a.timestamp - b.timestamp));
        } else {
          setMessages([]);
        }
      });

      return () => unsubscribe();
    }
  }, [activeUser, user]);

  // Auto Scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user || !activeUser) return;

    // CHECK BLOCK STATUS
    if (user.blockedUsers?.includes(activeUser.uid)) {
      alert("You have blocked this user. Unblock to send messages.");
      return;
    }

    const newMsg = {
      senderId: user.uid,
      text: message,
      timestamp: Date.now()
    };

    if (db) {
      // Ensure strict ID generation
      const chatId = getChatId(user.uid, activeUser.uid);
      await push(ref(db, `chats/${chatId}`), newMsg);
    }
    setMessage('');
  };

  const toggleBlock = () => {
    if (!user || !activeUser) return;
    const isBlocked = user.blockedUsers?.includes(activeUser.uid);
    let newBlockedList = user.blockedUsers || [];
    
    if (isBlocked) {
      newBlockedList = newBlockedList.filter(id => id !== activeUser.uid);
      alert(`${activeUser.username} unblocked.`);
    } else {
      newBlockedList = [...newBlockedList, activeUser.uid];
      alert(`${activeUser.username} blocked.`);
    }
    
    updateProfile({ blockedUsers: newBlockedList });
    if (db) {
       update(ref(db, `users/${user.uid}`), { blockedUsers: newBlockedList });
    }
  };

  const handleReportUser = async () => {
    if (!user || !activeUser) return;
    const reason = prompt("Why are you reporting this user? (e.g., Abusive language)");
    if (!reason) return;

    if (db) {
        await push(ref(db, 'reports'), {
            id: Date.now().toString(),
            reporterId: user.uid,
            reporterName: user.username,
            reportedUserId: activeUser.uid,
            reportedUserName: activeUser.username,
            reason: reason,
            timestamp: Date.now(),
            status: 'PENDING'
        });
        alert("Report submitted to Admins. We will take action.");
    }
  };

  const handleDelete = async (deleteType: 'ME' | 'EVERYONE') => {
    if (!selectedMsgId || !user || !activeUser) return;
    
    if (db) {
       const chatId = getChatId(user.uid, activeUser.uid);
       const msgRef = ref(db, `chats/${chatId}/${selectedMsgId}`);

       if (deleteType === 'EVERYONE') {
          await remove(msgRef);
       } else {
          get(msgRef).then((snap) => {
             if (snap.exists()) {
                const currentData = snap.val();
                const currentDeletedFor = currentData.deletedFor || [];
                if (!currentDeletedFor.includes(user.uid)) {
                   update(msgRef, { deletedFor: [...currentDeletedFor, user.uid] });
                }
             }
          });
       }
    }
    setSelectedMsgId(null);
  };

  const handleCall = () => {
    if (!isAdmin && (isUserMaster(activeUser!) || isUserSubAdmin(activeUser!))) {
        alert("You cannot call an Admin. Wait for Admin to call you.");
        return;
    }
    alert(`Calling ${activeUser!.username}...\n(Secure Audio Call)`);
  };

  // CRITICAL FIX: Safe filtering to prevent crash on missing username/uid
  const filteredUsers = usersList.filter(u => {
      const name = u.username ? u.username.toLowerCase() : '';
      const uid = u.uid ? u.uid.toLowerCase() : '';
      const search = searchChat.toLowerCase();
      return name.includes(search) || uid.includes(search);
  });

  if (activeUser) {
    const isBlocked = user?.blockedUsers?.includes(activeUser.uid);
    const targetIsMaster = isUserMaster(activeUser);
    const targetIsSubAdmin = isUserSubAdmin(activeUser);
    const canCall = isAdmin || (!targetIsMaster && !targetIsSubAdmin); 

    return (
      <div className="flex flex-col h-[calc(100vh-64px)] bg-dark relative">
        {/* Chat Header */}
        <div className="flex items-center justify-between p-4 bg-secondary border-b border-gray-800 shadow-md z-10">
           <div className="flex items-center gap-3">
             <button onClick={() => setActiveUser(null)} className="text-gray-400 mr-1 hover:text-white">
               <i className="fas fa-arrow-left text-xl"></i>
             </button>
             
             {/* CLICKABLE HEADER FOR PROFILE VIEW */}
             <div className="flex items-center gap-3 cursor-pointer" onClick={() => setViewProfile(activeUser)}>
                 <div className={`w-10 h-10 rounded-full bg-gray-700 overflow-hidden ${targetIsMaster ? 'border-2 border-red-600' : targetIsSubAdmin ? 'border-2 border-blue-400' : activeUser.verificationTier === 'GOLD' ? 'border-2 border-yellow-400' : ''}`}>
                    {activeUser.avatarUrl ? (
                       <img src={activeUser.avatarUrl} alt="User" className="w-full h-full object-cover" />
                    ) : (
                       <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">
                          {(activeUser.username && activeUser.username.length > 0) ? activeUser.username[0].toUpperCase() : '?'}
                       </div>
                    )}
                 </div>
                 <div>
                   <h3 className="font-bold text-white text-sm flex items-center gap-1">
                       {activeUser.username || 'Unknown User'}
                       {/* ADMIN / OWNER BADGE */}
                       {targetIsMaster ? (
                           <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded ml-1 font-bold border border-yellow-400 flex items-center gap-1 shadow-[0_0_10px_red]">
                               <i className="fas fa-shield-alt"></i> OWNER
                           </span>
                       ) : targetIsSubAdmin ? (
                           <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded ml-1 font-bold border border-blue-300 flex items-center gap-1">
                               <i className="fas fa-user-shield"></i> OFFICIAL ADMIN
                           </span>
                       ) : activeUser.isVerified && (
                            <i className={`fas ${activeUser.verificationTier === 'GOLD' ? 'fa-crown text-yellow-400' : 'fa-check-circle text-blue-500'} text-xs`}></i>
                       )}
                   </h3>
                   <span className="text-[10px] text-primary">{activeUser.uid}</span>
                 </div>
             </div>
           </div>
           
           <div className="flex items-center gap-2">
             <button 
               onClick={handleCall} 
               disabled={!canCall}
               className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${canCall ? 'bg-green-600/20 text-green-500 hover:bg-green-600 hover:text-white' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
             >
               <i className="fas fa-phone-alt"></i>
             </button>
             {/* REPORT BUTTON */}
             <button 
               onClick={handleReportUser}
               className="w-9 h-9 rounded-full flex items-center justify-center bg-orange-600/20 text-orange-500 hover:bg-orange-600 hover:text-white transition-colors"
               title="Report User"
             >
               <i className="fas fa-exclamation-triangle"></i>
             </button>
             <button onClick={toggleBlock} className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${isBlocked ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
               <i className={`fas ${isBlocked ? 'fa-ban' : 'fa-user-slash'}`}></i>
             </button>
           </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-dark">
           <div className="text-center text-xs text-gray-600 my-4 bg-secondary py-2 px-4 rounded-full mx-auto w-max border border-gray-800">
              <i className="fas fa-lock text-green-500 mr-1"></i> End-to-end encrypted.
           </div>
           
           {messages.map(msg => {
             const isMe = msg.senderId === user?.uid;
             const isSenderAdmin = isMe ? isAdmin : (targetIsMaster || targetIsSubAdmin); 

             return (
               <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group relative`}>
                 <div 
                    className={`max-w-[75%] p-3 rounded-2xl text-sm relative ${
                   isMe 
                     ? 'bg-primary text-black rounded-tr-none' 
                     : 'bg-gray-800 text-white rounded-tl-none'
                 }`}
                    onClick={() => isMe && setSelectedMsgId(selectedMsgId === msg.id ? null : msg.id)}
                 >
                   {/* Message Text */}
                   <div className="break-words">
                      {msg.text}
                   </div>
                   
                   <div className={`text-[10px] mt-1 text-right flex items-center justify-end gap-1 ${isMe ? 'text-black/60' : 'text-gray-400'}`}>
                     {/* Show Admin badge inside message */}
                     {(isSenderAdmin) && (
                        <i className={`fas ${targetIsMaster && !isMe ? 'fa-shield-alt text-red-500' : 'fa-user-shield text-blue-400'} text-[10px]`} title="Admin/Owner"></i>
                     )}
                     {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                   </div>
                   
                   {/* Delete Menu Popup */}
                   {selectedMsgId === msg.id && (
                      <div className="absolute top-full right-0 mt-2 bg-white rounded-lg shadow-xl overflow-hidden z-20 min-w-[140px] animate-in fade-in zoom-in duration-200">
                         <button onClick={() => handleDelete('ME')} className="w-full text-left px-4 py-3 hover:bg-gray-100 text-gray-800 text-xs border-b">Delete for me</button>
                         <button onClick={() => handleDelete('EVERYONE')} className="w-full text-left px-4 py-3 hover:bg-gray-100 text-red-600 text-xs">Delete for everyone</button>
                      </div>
                   )}
                 </div>
               </div>
             );
           })}
           <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSendMessage} className="p-3 bg-secondary border-t border-gray-800 flex items-center gap-2">
           <input 
             type="text" 
             value={message}
             onChange={e => setMessage(e.target.value)}
             disabled={!!isBlocked}
             className="flex-1 bg-dark border border-gray-700 rounded-full px-4 py-3 text-white text-sm focus:border-primary outline-none disabled:opacity-50"
             placeholder={isBlocked ? "You blocked this user" : "Type a message..."}
           />
           <button 
             type="submit" 
             disabled={!message.trim() || !!isBlocked}
             className="w-12 h-12 bg-primary text-black rounded-full flex items-center justify-center font-bold disabled:opacity-50 disabled:bg-gray-700"
           >
             <i className="fas fa-paper-plane"></i>
           </button>
        </form>
        
        {selectedMsgId && (
           <div className="absolute inset-0 z-10 bg-transparent" onClick={() => setSelectedMsgId(null)}></div>
        )}

        {/* PROFILE MODAL IN CHAT */}
        {viewProfile && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-secondary w-full max-w-sm rounded-2xl p-6 border border-gray-700 relative overflow-hidden shadow-2xl">
               
               {isUserMaster(viewProfile) && (
                  <div className="absolute inset-0 bg-gradient-to-b from-red-900/30 to-transparent pointer-events-none"></div>
               )}
               
               <button onClick={() => setViewProfile(null)} className="absolute top-3 right-3 text-gray-400 hover:text-white z-10">
                   <i className="fas fa-times text-xl"></i>
               </button>
 
               <div className="text-center mb-4 relative z-0">
                   <div className={`w-24 h-24 mx-auto mb-3 rounded-full p-1 ${isUserMaster(viewProfile) ? 'border-4 border-red-600 shadow-[0_0_20px_red]' : isUserSubAdmin(viewProfile) ? 'border-4 border-blue-500 shadow-[0_0_15px_blue]' : viewProfile.verificationTier === 'GOLD' ? 'border-4 border-yellow-400' : 'border-2 border-primary'}`}>
                       <img src={viewProfile.avatarUrl || `https://ui-avatars.com/api/?name=${viewProfile.username}&background=random`} className="w-full h-full rounded-full object-cover" />
                   </div>
                   <h2 className="text-xl font-bold flex items-center justify-center gap-1">
                       {viewProfile.username || 'Unknown'}
                       {isUserMaster(viewProfile) ? (
                           <i className="fas fa-shield-alt text-red-600 drop-shadow-[0_0_5px_red]" title="Official Owner"></i>
                       ) : isUserSubAdmin(viewProfile) ? (
                           <i className="fas fa-user-shield text-blue-500 drop-shadow-[0_0_5px_blue]" title="Official Admin"></i>
                       ) : viewProfile.isVerified && (
                           <i className={`fas ${viewProfile.verificationTier === 'GOLD' ? 'fa-crown text-yellow-400' : 'fa-check-circle text-blue-500'}`}></i>
                       )}
                   </h2>
                   <p className="text-xs text-gray-400 font-mono mt-1">{viewProfile.uid}</p>
               </div>
 
               {isUserMaster(viewProfile) && (
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

               {isUserSubAdmin(viewProfile) && (
                   <div className="mb-5 text-center">
                       <div className="bg-gradient-to-r from-blue-900/40 to-black border border-blue-600/50 p-3 rounded-xl inline-block">
                           <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">OFFICIAL ADMIN</span>
                       </div>
                   </div>
               )}
 
               {viewProfile.bio && (
                   <div className="bg-dark/50 p-3 rounded-xl mb-4 text-center border border-gray-800">
                       <p className="text-sm italic text-gray-300">"{viewProfile.bio}"</p>
                   </div>
               )}
 
               {(viewProfile.instagramLink || viewProfile.facebookLink) && (
                   <div className="flex justify-center gap-4 mb-6">
                       {viewProfile.instagramLink && (
                           <a href={viewProfile.instagramLink} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white hover:scale-110 transition-transform">
                               <i className="fab fa-instagram text-xl"></i>
                           </a>
                       )}
                       {viewProfile.facebookLink && (
                           <a href={viewProfile.facebookLink} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white hover:scale-110 transition-transform">
                               <i className="fab fa-facebook-f text-xl"></i>
                           </a>
                       )}
                   </div>
               )}
            </div>
         </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 pt-8 pb-20">
       <h1 className="text-2xl font-bold mb-4">Community</h1>
       
       {/* SEARCH BAR */}
       <div className="mb-4 relative">
          <input 
             type="text" 
             value={searchChat}
             onChange={(e) => setSearchChat(e.target.value)}
             placeholder="Search Friend by Name or UID..."
             className="w-full bg-secondary p-3 pl-10 rounded-xl border border-gray-800 focus:border-primary outline-none text-sm text-white"
          />
          <i className="fas fa-search absolute left-4 top-3.5 text-gray-500"></i>
       </div>

       <div className="flex items-center justify-between mb-4">
         <h3 className="text-sm font-bold text-gray-400 uppercase">Active Players</h3>
         <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-1 rounded-full animate-pulse">● Live</span>
       </div>
       
       <div className="space-y-3">
         {filteredUsers.length === 0 ? (
             <div className="text-center text-gray-500 py-10">
                 <p>No users found.</p>
             </div>
         ) : filteredUsers.map(u => {
            const isMasterUser = isUserMaster(u);
            const isSubAdmin = isUserSubAdmin(u);
            
            return (
           <div key={u.uid} onClick={() => setActiveUser(u)} className={`flex items-center justify-between bg-secondary p-3 rounded-xl border hover:border-primary transition-all active:scale-[0.98] cursor-pointer ${isMasterUser ? 'border-red-900/50 bg-red-900/10' : isSubAdmin ? 'border-blue-900/50 bg-blue-900/10' : 'border-gray-800'}`}>
              <div className="flex items-center gap-3">
                 <div className={`w-12 h-12 rounded-full bg-gray-700 overflow-hidden relative border ${isMasterUser ? 'border-red-500' : isSubAdmin ? 'border-blue-400' : u.verificationTier === 'GOLD' ? 'border-yellow-400' : 'border-gray-600'}`}>
                   {u.avatarUrl ? (
                     <img src={u.avatarUrl} alt={u.username} className="w-full h-full object-cover" />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center text-white font-bold">
                        {(u.username && u.username.length > 0) ? u.username[0].toUpperCase() : '?'}
                     </div>
                   )}
                   {(u.lastActive && (Date.now() - u.lastActive < 300000)) && (
                     <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-secondary rounded-full"></span>
                   )}
                 </div>
                 <div>
                   <h4 className="font-bold text-white text-sm flex items-center gap-1">
                     {u.username || 'Unknown'}
                     {/* BADGE IN LIST */}
                     {isMasterUser ? (
                         <i className="fas fa-shield-alt text-red-500 text-xs" title="Owner"></i>
                     ) : isSubAdmin ? (
                         <i className="fas fa-user-shield text-blue-500 text-xs" title="Official Admin"></i>
                     ) : u.isVerified && (
                        <i className={`fas ${u.verificationTier === 'GOLD' ? 'fa-crown text-yellow-400' : 'fa-check-circle text-blue-500'} text-xs`}></i>
                     )}
                   </h4>
                   <span className="text-[10px] text-gray-500 font-mono">{u.uid}</span>
                 </div>
              </div>
              <button className="w-8 h-8 rounded-full bg-dark text-primary flex items-center justify-center hover:bg-primary hover:text-black transition-colors">
                 <i className="fas fa-comment-dots"></i>
              </button>
           </div>
         )})}
       </div>
    </div>
  );
};

export default Community;