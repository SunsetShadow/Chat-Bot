export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  all_day: boolean;
  color: string | null;
  location: string | null;
  remind_before_ms: number | null;
  recurrence_rule: string | null;
  source: 'calendar' | 'cron_job';
  source_id: string | null;
  agent_id: string | null;
  created_by_session: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEventRequest {
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  all_day?: boolean;
  color?: string;
  location?: string;
  remind_before_ms?: number;
}

export interface UpdateEventRequest {
  title?: string;
  description?: string | null;
  start_time?: string;
  end_time?: string | null;
  all_day?: boolean;
  color?: string | null;
  location?: string | null;
  remind_before_ms?: number | null;
}
