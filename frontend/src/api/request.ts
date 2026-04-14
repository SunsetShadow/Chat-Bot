export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "";

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

/**
 * 基础请求封装
 */
export async function request<T>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const { params, ...init } = options;

  // 构建查询参数
  let fullUrl = `${API_BASE_URL}${url}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      fullUrl += `?${queryString}`;
    }
  }

  // 默认请求头
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...init.headers,
  };

  const response = await fetch(fullUrl, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail?.message ||
        errorData.message ||
        `HTTP ${response.status}`,
    );
  }

  return response.json();
}

/**
 * GET 请求
 */
export function get<T>(
  url: string,
  params?: Record<string, string | number | boolean>,
): Promise<T> {
  return request<T>(url, { method: "GET", params });
}

/**
 * POST 请求
 */
export function post<T>(url: string, data?: unknown): Promise<T> {
  return request<T>(url, {
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PUT 请求
 */
export function put<T>(url: string, data?: unknown): Promise<T> {
  return request<T>(url, {
    method: "PUT",
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * DELETE 请求
 */
export function del<T>(url: string): Promise<T> {
  return request<T>(url, { method: "DELETE" });
}

/**
 * PATCH 请求
 */
export function patch<T>(url: string, data?: unknown): Promise<T> {
  return request<T>(url, {
    method: "PATCH",
    body: data ? JSON.stringify(data) : undefined,
  });
}
