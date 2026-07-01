export interface UserObj {
  username: string;
  profilePic?: string;
  statusMessage?: string;
  role?: string;
  countryLanguage?: string;
  pais_idioma?: string;
  securityEmail?: string;
  timezone?: string;
  systemInstruction?: string;
  friends_list?: string[];
  blocked_list?: string[];
  is_friends_public?: boolean;
  awards?: string[];
  friend_requests?: any[];
  preferred_background?: string;
  preferred_theme?: string;
  isAi?: boolean;
}

export interface TutiFruttiState {
  isActive: boolean;
  players: string[];
  currentLetter: string;
  scores: Record<string, number>;
  roundEndTime: number;
  answers: Record<string, any>;
  maxPlayers: number;
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
  isAi?: boolean;
}
