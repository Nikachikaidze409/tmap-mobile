export type ServiceErrorCode = 'NOT_CONFIGURED' | 'NOT_IMPLEMENTED' | 'INVALID_CODE' | 'INVALID_CONFIG' | 'CONNECTION_LOST';

export class ServiceError extends Error {
  constructor(public readonly code: ServiceErrorCode) {
    super(code);
    this.name = 'ServiceError';
  }
}

export function unavailable(): never {
  throw new ServiceError('NOT_IMPLEMENTED');
}

/** Never display arbitrary server errors, credentials, or pairing codes. */
export function connectionErrorMessage(error: unknown): string {
  if (error instanceof ServiceError) {
    switch (error.code) {
      case 'INVALID_CODE': return 'That code was not recognized. Check the code and try again.';
      case 'NOT_CONFIGURED': return 'Configure the public Supabase URL and publishable key to connect.';
      case 'INVALID_CONFIG': return 'Supabase client configuration is invalid. Check the public URL and publishable key.';
      case 'CONNECTION_LOST': return 'Connection lost. Enter a new pairing code.';
      case 'NOT_IMPLEMENTED': return 'This feature is not available yet.';
    }
  }
  return 'Could not connect to Tesla. Please try again.';
}
