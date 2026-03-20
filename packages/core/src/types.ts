export type LeadStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type ClinicSize = 'small' | 'medium' | 'large';

export type Priority = 'low' | 'medium' | 'high';

export interface Extracted {
  services: string[];
  has_online_booking: boolean;
  clinic_size: ClinicSize;
  pain_points: string[];
  confidence: number;
}

export interface Score {
  score: number;
  priority: Priority;
  reason: string;
  confidence: number;
}

export interface Outreach {
  subject: string;
  body: string;
}

export interface Lead {
  id: string;
  name: string;
  address: string;
  website?: string;
  place_id?: string;
  status: LeadStatus;
  extracted?: Extracted;
  score?: Score;
  outreach?: Outreach | null;
  failureReason?: string;
}

export interface GooglePlaceResult {
  id: string;
  name: string;
  address: string;
  website?: string;
}
