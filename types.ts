export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN', // Master Owner
  SUB_ADMIN = 'SUB_ADMIN' // Official Admin (Staff)
}

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  balance: number;
  ff_uid?: string;
  username: string;
  isBlocked: boolean;
  isVerified?: boolean; // Standard Blue tick
  verificationTier?: 'BLUE' | 'GOLD'; // BLUE = Standard, GOLD = Premium
  verificationStatus?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  verificationExpiry?: number; // Timestamp when verification expires
  // hasOwnerBadge removed -> Now derived strictly from UID
  instagramLink?: string;
  facebookLink?: string;
  createdAt: number;
  avatarUrl?: string;
  bio?: string;
  gender?: 'Male' | 'Female' | 'Other';
  blockedUsers?: string[];
  lastActive?: number;
  // Referral System
  referredBy?: string;
  referralCount?: number; // Total signups
  validReferralCount?: number; // Total users who deposited
  hasDeposited?: boolean;
  // Leaderboard Stats
  totalWinnings?: number; // Lifetime winnings calculation
}

export interface AppSettings {
  maintenanceMode: boolean;
  adminUpi: string;
  adminWhatsapp: string;
  depositInstruction: string;
  withdrawInstruction: string;
  minWithdraw: number;
  referralTarget: number; // How many valid referrals for Blue Tick
  qrCodeUrl?: string; // Added for Dynamic QR
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: number;
}

export interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  reportedUserId: string;
  reportedUserName: string;
  reason: string;
  timestamp: number;
  status: 'PENDING' | 'RESOLVED';
}

export interface Tournament {
  key?: string; // Firebase Node Key
  id: string; // Timestamp ID
  title: string;
  map: string;
  type: 'SOLO' | 'DUO' | 'SQUAD';
  entryFee: number;
  prizePool: number;
  perKill: number;
  date: string;
  time: string;
  maxSlots: number;
  filledSlots: number;
  status: 'OPEN' | 'FULL' | 'COMPLETED' | 'CANCELLED';
  roomId?: string;
  roomPass?: string;
  image?: string;
  gameLink?: string; // Custom Link to open game
  participants?: Record<string, boolean>; // Map of UserUIDs who joined
}

export interface MatchParticipant {
  userId: string;
  username: string;
  ff_uid: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'DEPOSIT' | 'WITHDRAW' | 'JOIN_FEE' | 'WINNINGS' | 'REFUND' | 'ADMIN_ADJUSTMENT' | 'COMMISSION';
  amount: number;
  timestamp: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  description?: string;
  netAmount?: number; // For withdrawals (Amount after 5% cut)
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
}