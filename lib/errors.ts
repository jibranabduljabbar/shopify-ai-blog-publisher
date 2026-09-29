export class AppError extends Error {
  constructor(public code: string, message: string, public status = 502) {
    super(message);
    this.name = "AppError";
  }
}

export function publicError(error: unknown) {
  if (error instanceof AppError) return { code: error.code, message: error.message, status: error.status };
  return { code: "UNEXPECTED_ERROR", message: "The run failed. Check configuration and retry after inspecting the store.", status: 500 };
}
