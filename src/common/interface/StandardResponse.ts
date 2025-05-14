export interface StandardResponse<T> {
  data?: T;
  error: boolean;
  description?: string;
  error_code?: number;
}
