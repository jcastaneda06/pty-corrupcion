export type Severity = 'critico' | 'alto' | 'medio' | 'bajo';

export type NotificationType = 'system' | 'reaction' | 'comment_reply';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export type RelationshipType = 'familiar' | 'socio_comercial' | 'politico' | 'empleado' | 'otro';

export interface FindingComment {
  id: string;
  finding_id: string;
  user_id: string;
  author_name: string;
  author_email: string;
  content: string;
  created_at: string;
}

export interface Reaction {
  id: string;
  finding_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface Finding {
  id: string;
  title: string;
  summary: string;
  severity: Severity;
  category: string;
  status: 'activo' | 'archivado' | 'resuelto';
  amount_usd: number | null;
  date_reported: string | null;
  date_occurred: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
  // joined fields
  people?: FindingPerson[];
  sources?: Source[];
  reactions?: Reaction[];
  finding_comments?: FindingComment[];
}

export interface Person {
  id: string;
  name: string;
  role: string | null;
  institution: string | null;
  nationality: string;
  is_public_figure: boolean;
  photo_url: string | null;
  bio: string | null;
  created_at: string;
  // joined fields
  findings?: FindingPerson[];
  relationships?: PersonRelationship[];
}

export interface FindingPerson {
  id: string;
  finding_id: string;
  person_id: string;
  role_in_case: string | null;
  amount_usd: number | null;
  is_convicted: boolean;
  notes: string | null;
  person?: Person;
  finding?: Finding;
}

export interface PersonRelationship {
  id: string;
  person_a_id: string;
  person_b_id: string;
  relationship: RelationshipType;
  description: string | null;
  created_at: string;
  person_a?: Person;
  person_b?: Person;
}

export interface Source {
  id: string;
  finding_id: string;
  url: string;
  title: string | null;
  outlet: string | null;
  published_at: string | null;
  created_at: string;
}

export interface ScrapeLog {
  id: string;
  run_at: string;
  sources_checked: number;
  articles_found: number;
  findings_created: number;
  status: 'success' | 'partial' | 'error';
  error_message: string | null;
  duration_ms: number | null;
}

export interface DashboardStats {
  total_findings: number;
  total_amount_usd: number;
  by_severity: Record<Severity, number>;
  by_category: Record<string, number>;
  recent_findings: Finding[];
}

// Filters for the findings list page
export interface FindingFilters {
  severity?: Severity | '';
  category?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: 'date_desc' | 'date_asc' | '';
}
