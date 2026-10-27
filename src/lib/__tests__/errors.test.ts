import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  AuthorizationError,
  ConflictError,
  DatabaseError,
  ImportError,
  SyncError,
  BackupError,
  IntegrityError,
  MigrationError
} from '../errors';

describe('Application Error Hierarchy (Section 52)', () => {
  it('instantiates ValidationError with correct code and prototype', () => {
    const err = new ValidationError('Invalid amount', { field: 'dac' });
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Invalid amount');
    expect(err.details).toEqual({ field: 'dac' });
    expect(err.timestamp).toBeDefined();
  });

  it('instantiates AuthorizationError with default message if none provided', () => {
    const err = new AuthorizationError();
    expect(err.code).toBe('AUTHORIZATION_ERROR');
    expect(err.message).toContain('Unauthorized');
  });

  it('instantiates all typed error classes correctly', () => {
    expect(new ConflictError('Merge conflict').code).toBe('CONFLICT_ERROR');
    expect(new DatabaseError('Dexie write failed').code).toBe('DATABASE_ERROR');
    expect(new ImportError('Malformed headers').code).toBe('IMPORT_ERROR');
    expect(new SyncError('Peer unreachable').code).toBe('SYNC_ERROR');
    expect(new BackupError('Checksum mismatch').code).toBe('BACKUP_ERROR');
    expect(new IntegrityError('Hash chain broken').code).toBe('INTEGRITY_ERROR');
    expect(new MigrationError('Schema v3 failed').code).toBe('MIGRATION_ERROR');
  });
});
