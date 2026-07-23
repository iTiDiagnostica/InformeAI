// ==========================================
// CENTRALIZED TYPES FOR MEDICAL REPORT SYSTEM
// ==========================================

export interface Company {
  id: number;
  name: string;
  logoBase64?: string;
  faviconBase64?: string;
  colorPrimary: string;
  colorSecondary: string;
  colorAccent: string;
  created_at?: string;
}

export interface Doctor {
  id: number;
  name: string;
  specialty: string;
  style_directives?: string;
  folder_name?: string;
  username?: string;
  companyId?: number;
  companyName?: string;
}

export interface Report {
  id?: number;
  rawText: string;
  structuredText: string;
  createdAt?: string;
  doctorId?: number | null;
  doctorName?: string | null;
  doctorSpecialty?: string | null;
  reportType?: string;
  createdByRole?: string;
  aiType?: string;
  rating?: number;
  isExemplar?: boolean;
}

export interface DocumentItem {
  id: number;
  title: string;
  length: number;
  created_at: string;
  doctorId: number | null;
  doctorName?: string | null;
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

// Speech Recognition API Types
export interface SpeechRecognitionResultList {
  length: number;
  item(index: number): { isFinal: boolean; [key: number]: { transcript: string } };
  [index: number]: {
    isFinal: boolean;
    length: number;
    [key: number]: {
      transcript: string;
    };
  };
}

export interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: { error: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}
