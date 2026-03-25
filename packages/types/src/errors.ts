export class DataAccessError extends Error {
  constructor(
    public readonly table: string,
    public readonly operation: string,
    public readonly cause: string,
  ) {
    super(`DataAccess error on ${table}.${operation}: ${cause}`)
    this.name = 'DataAccessError'
  }
}
