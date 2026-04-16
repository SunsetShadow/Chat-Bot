export interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  is_read: boolean;
  job_id: string | null;
  session_id: string | null;
  created_at: string;
}
