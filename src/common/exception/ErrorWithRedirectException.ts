export class ErrorWithRedirectException extends Error {
  public readonly redirectUrl: string;

  constructor(message: string, redirectUrl: string) {
    super(message);
    this.redirectUrl = redirectUrl;
  }
}
