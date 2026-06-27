export interface DBState {
  users: Record<string, { password?: string, profilePic?: string, statusMessage?: string, role?: string, pais_idioma?: string, securityEmail?: string, timezone?: string, systemInstruction?: string }>;
  globalMessages: any[];
}
