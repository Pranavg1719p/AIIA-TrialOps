import { requestId } from "./util";

export class AppError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const errValidation = (m: string) => new AppError(400, m);
export const errForbidden = (m = "You do not have permission to perform this action.") =>
  new AppError(403, m);
export const errNotFound = (m = "Record not found.") => new AppError(404, m);
export const errConflict = (m: string) => new AppError(409, m);
