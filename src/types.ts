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
  blocked_list?: string[];
  is_friends_public?: boolean;
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
