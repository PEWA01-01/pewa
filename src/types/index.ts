export type UserRole = 'user' | 'admin' | 'superadmin';
export type TabType = 'find_love' | 'chats' | 'posts' | 'notifications' | 'account' | 'admin';

export type Gender = 'Male' | 'Female' | 'Other';
export type DrinkingPref = 'Never' | 'Socially' | 'Regularly';
export type SmokingPref = 'Never' | 'Socially' | 'Regularly';
export type PartyingPref = 'Never' | 'Weekends' | 'Often';
export type SexualActivityPref = 'Low' | 'Moderate' | 'High' | 'Prefer not to say';
export type VisitingPref = 'Host' | 'Visit' | 'Public Places Only' | 'Flexible';
export type PersonalityType = 'Indoor' | 'Outdoor' | 'Balanced';

export type SugarRoleType = 'Sugar Baby (Male)' | 'Sugar Baby (Female)' | 'Sugar Mama' | 'Sugar Daddy';

export interface SugarPhotos {
  face: string;
  fullBody: string;
  additional: string;
}

export interface SugarProfile {
  isEligible?: boolean;
  active: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  type: SugarRoleType;
  relationshipPreferences: string[];
  financialSupportWilling?: boolean;
  monthlySupportBudget?: string;
  monthlyIncomeRange?: string;
  height?: string;
  skinTone?: string;
  ethnicity?: string;
  occupation?: string;
  employmentStatus?: string;
  country?: string;
  city?: string;
  area?: string;
  childrenCount?: number;
  preferredPartnerAgeMin?: number;
  preferredPartnerAgeMax?: number;
  preferredPartnerHeight?: string;
  preferredPartnerLocation?: string;
  languages?: string[];
  educationLevel?: string;
  bio: string;
  hobbies?: string[];
  lifestylePreferences?: string[];
  photos?: SugarPhotos;
  expectationOrAllowance?: string;
  preferredPerks?: string[];
  termsAccepted: boolean;
  termsAcceptedAt?: number;
  approvedAt?: number;
}

export interface UserProfilePhotos {
  fullBody?: string;
  normalFace?: string;
  naturalPhoto?: string;
  extra1?: string;
  extra2?: string;
}

export interface PrivacySettings {
  profileVisibility?: 'public' | 'friends' | 'private' | 'everyone' | 'verified_only' | 'hidden';
  photosVisibility?: 'everyone' | 'verified_only' | 'hidden';
  showOnlineStatus?: boolean;
  allowDirectMessages?: boolean;
  showLocation?: boolean;
  whoCanMessageMe?: 'everyone' | 'matched' | 'verified';
  whoCanSeeProfile?: 'everyone' | 'matched' | 'none' | 'verified_only' | 'hidden';
  whoCanSeeOnlineStatus?: 'everyone' | 'matched' | 'nobody';
  lastSeenVisibility?: 'everyone' | 'matched' | 'nobody';
  profilePhotoVisibility?: 'everyone' | 'matched' | 'nobody' | 'verified_only' | 'hidden';
}

export interface NotificationPreferences {
  messageNotifications: boolean;
  findLoveNotifications: boolean;
  sugarsNotifications: boolean;
  broadcastNotifications: boolean;
  verificationNotifications: boolean;
}

export interface UserSettings {
  theme?: 'dark' | 'light' | 'system';
  notificationsEnabled?: boolean;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  soundEnabled?: boolean;
  notificationPreferences?: NotificationPreferences;
  privacy?: PrivacySettings;
  security?: {
    twoFactorEnabled?: boolean;
  };
  chat?: {
    fontSize?: 'small' | 'medium' | 'large';
    mediaAutoDownloadWifi?: boolean;
    mediaAutoDownloadCellular?: boolean;
    chatWallpaper?: string;
    messageNotifications?: boolean;
    readReceipts?: boolean;
    typingIndicators?: boolean;
    voiceMessageAutoPlay?: boolean;
  };
  language?: string;
}

export interface UserPreferences {
  ageMin: number;
  ageMax: number;
  preferredGender: string;
  maxDistanceKm: number;
  relationshipGoals: string;
}

export interface UserStatistics {
  totalMatches: number;
  totalChats: number;
  totalPosts: number;
  totalVotes: number;
  totalPops: number;
  totalKeeps: number;
  lastActiveTimestamp: number;
}

export interface UserNotificationsData {
  items: NotificationItem[];
  unreadCount: number;
}

export interface UserChatMetadata {
  activeChats: string[];
  pinnedChats: string[];
  archivedChats: string[];
}

export interface UserFriendsData {
  friendsList: string[];
  following: string[];
  followers: string[];
  blocked: string[];
}

export interface UserSavedPostsData {
  postIds: string[];
}

export interface UserUpdatesData {
  updatesList: any[];
}

export interface UserProfile {
  uid: string;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  normalizedPhones: string[];
  pinHash: string;
  pinCreatedAt?: number;
  pinUpdatedAt?: number;
  dob: string; // YYYY-MM-DD
  age: number;
  gender: Gender;
  country: string;
  city: string;
  street: string;
  relationshipOrientation: string; // e.g. Single, Dating, Serious, Marriage
  personality: PersonalityType;
  lifestyle: {
    drinking: DrinkingPref;
    smoking: SmokingPref;
    partying: PartyingPref;
    sexualActivity: SexualActivityPref;
  };
  relationshipGoals: string;
  visitingPreferences: VisitingPref;
  bio: string;
  avatar: string;
  profilePhoto?: string;
  profileImage?: string;
  coverImage: string;
  coverPhoto?: string;
  isAdmin?: boolean;
  verified: boolean;
  verificationStatus?: 'pending' | 'approved' | 'rejected' | 'unverified' | 'expired';
  verificationApprovedDate?: number;
  verificationExpiryDate?: number;
  approvedByAdminId?: string;
  height?: string;
  skinTone?: string;
  hairColor?: string;
  eyeColor?: string;
  bodyType?: string;
  enjoysParties?: 'Yes' | 'No' | 'Sometimes';
  partyPreferences?: string[];
  clubPreferences?: string[];
  favoriteSocialPlaces?: string[];
  favoriteActivities?: string[];
  musicInterests?: string[];
  sports?: string[];
  entertainmentPreferences?: string[];
  lifestyleInterests?: string[];
  profilePhotos?: UserProfilePhotos;
  verifiedPhotos?: string[];
  imageVerificationStatus?: 'clean' | 'flagged' | 'rejected';
  rejectedPhotosReason?: string;
  catfishFlagged?: boolean;
  catfishReason?: string;
  permanentlyBlocked?: boolean;
  permanentlyBlockedReason?: string;
  lifestylePreferences?: {
    drinking?: DrinkingPref | string;
    smoking?: SmokingPref | string;
    partying?: PartyingPref | string;
    sexualActivity?: SexualActivityPref | string;
    relationshipStatus?: string;
  };
  interests?: string[];
  hobbies?: string[];
  thingsInterestedIn?: string[];
  keepCount?: number;
  popCount?: number;
  suspended: boolean;
  banned: boolean;
  bannedUntil?: number | null;
  disabled?: boolean;
  role: UserRole;
  sugarProfile?: SugarProfile;
  favoriteSugarUids?: string[];
  popsCount: number; // Followers
  keepsCount: number; // Following
  votesCount: number; // Total upvotes received
  termsAccepted: boolean;
  createdAt: number;
  updatedAt: number;

  // Provisioned sub-documents and settings
  settings?: UserSettings;
  preferences?: UserPreferences;
  statistics?: UserStatistics;
  notificationsData?: UserNotificationsData;
  chatMetadata?: UserChatMetadata;
  friendsData?: UserFriendsData;
  savedPostsData?: UserSavedPostsData;
  userUpdatesData?: UserUpdatesData;
  onlineStatus?: 'online' | 'offline';
  lastActiveTimestamp?: number;
}

export interface UserPresence {
  uid: string;
  status: 'online' | 'offline';
  lastSeen: number;
  currentChatId?: string | null;
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // uids
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  creatorId: string;
}

export interface DatePlan {
  id: string;
  chatId?: string;
  title: string;
  location: string;
  date?: string;
  time?: string;
  dateTime: string;
  notes?: string;
  status: 'pending' | 'accepted' | 'declined';
  proposerId: string;
}

export type MessageType = 'text' | 'poll' | 'date_plan' | 'game' | 'image' | 'video' | 'audio' | 'document';

export interface ChatGame {
  id: string;
  chatId: string;
  creatorId: string;
  gameType: 'truth_or_dare' | 'would_you_rather' | '20_questions' | 'never_have_i_ever';
  title: string;
  prompt: string;
  options?: string[];
  responses?: Record<string, string>;
  status: 'active' | 'completed';
  createdAt: number;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  receiverId: string;
  text: string;
  type: MessageType;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: string;
  voiceDuration?: number; // seconds
  audioEffect?: string;
  poll?: Poll;
  datePlan?: DatePlan;
  game?: ChatGame;
  replyToMessageId?: string;
  replyToText?: string;
  status: 'sent' | 'delivered' | 'seen';
  deletedFor?: string[]; // array of uids who deleted locally
  deletedForEveryone?: boolean;
  edited?: boolean;
  editedAt?: number;
  pinned?: boolean;
  reactions?: Record<string, string>; // uid -> emoji
  timestamp: number;
}

export interface Chat {
  id: string;
  participants: string[]; // uids
  participantProfiles?: Record<string, Partial<UserProfile>>;
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: Record<string, number>;
  muted?: Record<string, boolean>;
  archived?: Record<string, boolean>;
  pinnedMessageIds?: string[];
  theme?: string;
  updatedAt: number;
}

export interface Post {
  id: string;
  authorId: string;
  author: Partial<UserProfile>;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  upVotes: string[]; // array of user uids
  downVotes: string[]; // array of user uids
  commentsCount: number;
  hidden?: boolean;
  featured?: boolean;
  isOfficial?: boolean;
  isAd?: boolean;
  isBoosted?: boolean;
  boostExpiresAt?: number;
  authorRole?: UserRole;
  adCtaUrl?: string;
  adCtaText?: string;
  edited?: boolean;
  updatedAt?: number;
  createdAt: number;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  createdAt: number;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: 'vote' | 'pop' | 'keep' | 'share' | 'message' | 'broadcast' | 'call' | 'sugars' | 'verification' | 'like';
  title: string;
  body: string;
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
  chatId?: string;
  postId?: string;
  actionId?: string;
  read: boolean;
  createdAt: number;
}

export interface CallItem {
  id: string;
  callerId: string;
  callerName: string;
  callerAvatar: string;
  receiverId: string;
  receiverName?: string;
  receiverAvatar?: string;
  type: 'voice' | 'video';
  status: 'answered' | 'missed' | 'rejected' | 'cancelled' | 'completed' | 'ongoing';
  timestamp: number;
  duration?: number;
}

export interface PopItem {
  id: string;
  fromUserId: string;
  toUserId: string;
  timestamp: number;
}

export interface KeepItem {
  id: string;
  fromUserId: string;
  toUserId: string;
  timestamp: number;
}

export interface BlockItem {
  id: string;
  fromUserId: string;
  toUserId: string;
  timestamp: number;
}

export interface ManagedUserDisplayItem {
  id: string;
  userId: string;
  fullName: string;
  username: string;
  avatar: string;
  timestamp: number;
}

export interface ReportItem {
  id: string;
  reporterId: string;
  reporterName: string;
  reportedUserId?: string;
  reportedPostId?: string;
  reason: string;
  details: string;
  status: 'pending' | 'resolved';
  createdAt: number;
}

export interface Advertisement {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  targetUrl?: string;
  ctaText?: string;
  startDate?: string;
  endDate?: string;
  enabled: boolean;
  createdAt: number;
}

export interface VerificationRequest {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  userPhone: string;
  firstName?: string;
  lastName?: string;
  plan?: string; // e.g. 'Monthly - K50/month' or 'Yearly - K100/year'
  idFrontUrl?: string;
  idBackUrl?: string;
  selfieUrl?: string;
  paymentScreenshotUrl?: string;
  documentType: 'national_id' | 'passport' | 'drivers_license';
  documentUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: number;
}

export interface PostBoostRequest {
  id: string;
  userUid: string;
  userName: string;
  userAvatar?: string;
  userPhone?: string;
  postId: string;
  postContent?: string;
  postMediaUrl?: string;
  days: number;
  totalPayment: number;
  targetCountries: string[];
  targetAudience?: string;
  paymentScreenshotUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  boostExpiresAt?: number;
  createdAt: number;
}

export interface AdRequest {
  id: string;
  userUid: string;
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  description: string;
  bannerUrl: string;
  duration: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: number;
}

export interface PinResetRequest {
  id: string;
  uid: string;
  name: string;
  registeredEmail: string;
  registeredPhone: string;
  requestTime: number;
  status: 'Pending' | 'Resolved';
  deviceInfo?: string;
  resolvedAt?: number;
  resolvedBy?: string;
}

export interface SystemLog {
  id: string;
  action: string;
  adminId: string;
  details: string;
  timestamp: number;
}

export interface SystemConfig {
  supportWhatsappNumber: string;
  supportEmail: string;
  maintenanceMode: boolean;
  termsAndConditions: string;
  privacyPolicy: string;
  communityGuidelines: string;
  updatedAt: number;
}

export interface AdminConfig {
  email: string;
  role: 'admin';
  pin: string;
  createdAt: number;
  updatedAt: number;
}

export interface AdminProfileDocument {
  adminId: string;
  uid: string;
  email: string;
  role: 'admin' | 'superadmin';
  active: boolean;
  permissions: string[];
  fullName?: string;
  avatar?: string;
  bio?: string;
  supportWhatsappNumber?: string;
  supportEmail?: string;
  onesignalAppId?: string;
  onesignalRestApiKey?: string;
  appLogoUrl?: string;
  appThemeColor?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  activeUsersToday: number;
  newRegistrations: number;
  verifiedUsers: number;
  bannedUsers: number;
  suspendedUsers: number;
  disabledUsers: number;
  sugarBabies: number;
  sugarMamas: number;
  totalPosts: number;
  totalReports: number;
  adsCount: number;
  pendingVerificationsCount: number;
  pendingPinResetsCount: number;
  investmentRequestsCount: number;
}
