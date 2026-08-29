export class DomainError extends Error {
  readonly code: 'BAD_USER_INPUT' | 'FORBIDDEN' | 'NOT_FOUND';

  constructor(
    message: string,
    code: 'BAD_USER_INPUT' | 'FORBIDDEN' | 'NOT_FOUND' = 'BAD_USER_INPUT',
  ) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}
