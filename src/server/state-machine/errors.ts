export type TransitionEntity = "subscription" | "invoice";

export class InvalidTransitionError extends Error {
  readonly entity: TransitionEntity;
  readonly from: string;
  readonly to: string;
  readonly reason: string;

  constructor(entity: TransitionEntity, from: string, to: string, reason: string) {
    super(`Invalid ${entity} transition ${from} -> ${to}: ${reason}`);
    this.name = "InvalidTransitionError";
    this.entity = entity;
    this.from = from;
    this.to = to;
    this.reason = reason;
  }
}
