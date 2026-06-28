export interface UserObj {
  username: string;
  profilePic?: string;
  statusMessage?: string;
  role?: string;
  countryLanguage?: string;
  securityEmail?: string;
  timezone?: string;
  systemInstruction?: string;
  friends_list?: string[];
  friend_requests?: string[];
  blocked_list?: string[];
  is_friends_public?: boolean;
  awards?: string[];
}

export interface PlumaGameState {
  isActive: boolean;
  lastWriter: string | null;
  timerEndTime: number;
  phrases: { sender: string, text: string }[];
}

export interface HallOfFameEntry {
  id: string;
  title: string;
  phrases: { sender: string, text: string }[];
  authors: string[];
  date: number;
}

export interface MessageObj {
  id: string;
  text: string;
  sender: string;
  createdAt: number | Date | any;
  audio?: string;
  image?: string;
  type?: string;
}
