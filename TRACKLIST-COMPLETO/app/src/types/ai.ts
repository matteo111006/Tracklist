export type AiFeature = 'identity' | 'archive' | 'discovery' | 'wrapped';
export interface AiRequest { feature: AiFeature; question?: string; year?: number; tone?: 'narrative' | 'ironic'; conversationId?: string; }
export interface AiResult { text: string; albumIds: string[]; recommendations: { title: string; artist: string; reason: string }[]; model: string; includedAlbums: number; totalAlbums: number; cached?: boolean; generatedAt?: string; catalogFingerprint?: string; }
export interface AiTurn extends AiResult { id: string; question: string; generatedAt: string; catalogFingerprint: string; }
export interface AiConversation { id: string; title: string; feature: AiFeature; year?: number; tone?: 'narrative' | 'ironic'; createdAt: string; updatedAt: string; messages: AiTurn[]; }
