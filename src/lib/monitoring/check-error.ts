/** Terminal monitoring failures must not be retried into a false "no change". */
export class MonitorCheckError extends Error {
  readonly terminal: boolean;

  constructor(message: string, terminal = true) {
    super(message);
    this.name = "MonitorCheckError";
    this.terminal = terminal;
  }
}

export function isMonitorCheckError(error: unknown): error is MonitorCheckError {
  return error instanceof MonitorCheckError || (error instanceof Error && error.name === "MonitorCheckError");
}
