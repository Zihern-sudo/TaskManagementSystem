import { NextResponse } from "next/server";

export interface ApiSuccess<T = undefined> {
  success: true;
  message: string;
  data?: T;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

export type ApiResponse<T = undefined> = ApiSuccess<T> | ApiError;

/** 2xx success response */
export function ok<T>(
  message: string,
  data?: T,
  status: 200 | 201 = 200
): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true, message, ...(data !== undefined && { data }) }, { status });
}

/** 4xx / 5xx error response */
export function fail(
  message: string,
  status: 400 | 401 | 403 | 404 | 409 | 422 | 500 = 400,
  errors?: Record<string, string[]>
): NextResponse<ApiError> {
  return NextResponse.json(
    { success: false, message, ...(errors && { errors }) },
    { status }
  );
}
