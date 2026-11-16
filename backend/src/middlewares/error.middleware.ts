import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  public statusCode: number;
  public details?: any;

  constructor(message: string, statusCode = 500, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  // Zod Doğrulama Hatası
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Doğrulama Hatası (Validation Error)',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Özel AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      details: err.details,
    });
    return;
  }

  // Beklenmeyen Genel Hatalar
  console.error('[Global Error Handler]', err);
  res.status(500).json({
    success: false,
    error: 'Sunucu tarafında beklenmeyen bir hata oluştu.',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
}

