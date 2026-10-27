/**
 * Mahavtaar Ledger - Domain & Application Errors
 * Strongly Typed Application Error Hierarchy (Section 52)
 */

export class AppError extends Error {
  public readonly code: string;
  public readonly timestamp: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date().toISOString();
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', details);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Unauthorized: Insufficient permissions for this action', details?: Record<string, unknown>) {
    super(message, 'AUTHORIZATION_ERROR', details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFLICT_ERROR', details);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'DATABASE_ERROR', details);
  }
}

export class ImportError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'IMPORT_ERROR', details);
  }
}

export class SyncError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'SYNC_ERROR', details);
  }
}

export class BackupError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'BACKUP_ERROR', details);
  }
}

export class IntegrityError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'INTEGRITY_ERROR', details);
  }
}

export class MigrationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'MIGRATION_ERROR', details);
  }
}
