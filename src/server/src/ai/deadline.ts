import { AI_LIMITS } from '@specsentry/shared';
import type { AiClock, AiDeadline } from './contracts';
import { SafeAiError } from './gateway/accounting';

// One deadline includes admission, authorization, database waits, queue and provider work.
export class AiRequestDeadline implements AiDeadline {
  private readonly controller = new AbortController();
  private readonly end: number;
  private readonly timer: ReturnType<typeof setTimeout>;
  constructor(private readonly clock: AiClock, milliseconds: number = AI_LIMITS.deadlineMs) {
    this.end = clock.monotonicMs() + milliseconds;
    this.timer = setTimeout(() => this.controller.abort(), milliseconds);
    this.timer.unref?.();
  }
  get signal() { return this.controller.signal; }
  remainingMs() { return Math.max(0, this.end - this.clock.monotonicMs()); }
  assertRemaining() {
    if (this.signal.aborted || this.remainingMs() <= 0) {
      this.controller.abort(); throw new SafeAiError('DEADLINE');
    }
  }
  close() { clearTimeout(this.timer); this.controller.abort(); }
}
