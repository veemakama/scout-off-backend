import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiResponse } from '../types';
import { fail } from '../utils/response';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(err.message);
  if (err instanceof ZodError) {
    res.status(400).json(fail(err.errors[0].message));
    return;
  }
  const body: ApiResponse = { success: false, error: err.message };
  res.status(500).json(body);
}
