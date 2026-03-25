export type ApiResponse<T> = {
  data: T
  error: null
  meta?: Record<string, unknown>
}

export type ApiError = {
  data: null
  error: {
    code: string
    message: string
  }
}

export function success<T>(data: T, meta?: Record<string, unknown>): ApiResponse<T> {
  return { data, error: null, ...(meta ? { meta } : {}) }
}

export function error(code: string, message: string): ApiError {
  return { data: null, error: { code, message } }
}
