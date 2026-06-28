export interface UserObj {
  username: string;
  profilePic?: string;
  statusMessage?: string;
  role?: string;
  countryLanguage?: string;
  securityEmail?: string;
  timezone?: string;
  systemInstruction?: string;
}

export interface MessageObj {
  id: string;
  text: string;
  sender: string;
  createdAt: number | Date | any;
  audio?: string;
  image?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  type?: string;
}
