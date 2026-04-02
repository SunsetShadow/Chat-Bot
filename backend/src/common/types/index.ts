import { v4 as uuidv4 } from 'uuid';

export function generateId(): string {
  return uuidv4();
}

export function getCurrentTimestamp(): Date {
  return new Date();
}

export interface BaseResponse {
  success: boolean;
  message: string;
  code: string;
}

export interface DataResponse<T = any> extends BaseResponse {
  data: T;
}

export interface PaginationMeta {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PaginatedResponse<T = any> extends BaseResponse {
  data: T[];
  pagination: PaginationMeta;
}
