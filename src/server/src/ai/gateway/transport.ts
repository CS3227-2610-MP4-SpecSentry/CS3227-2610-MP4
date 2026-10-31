import type { AiClock, AiTransport, AiTransportRequest, AiTransportResponse, VerifiedTokenCounter } from '../contracts';
import { SafeAiError } from './accounting';

export class SystemAiClock implements AiClock {
  now(): Date { return new Date(); }
  monotonicMs(): number { return performance.now(); }
  sleep(milliseconds: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) { reject(new SafeAiError('DEADLINE')); return; }
      const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(); }, milliseconds);
      const onAbort = () => { clearTimeout(timer); reject(new SafeAiError('DEADLINE')); };
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }
}

export class DisabledTokenCounter implements VerifiedTokenCounter {
  readonly model = '';
  readonly verificationId = '';
  countInput(): number { throw new SafeAiError('CONFIGURATION'); }
}

export class SocLlmHttpsTransport implements AiTransport {
  private readonly approvedBase = 'https://soclaas-api.comp.nus.edu.sg/v1';
  async complete(request: AiTransportRequest): Promise<AiTransportResponse> {
    if (request.baseUrl !== this.approvedBase || !request.apiKey || !request.model) {
      throw new SafeAiError('CONFIGURATION');
    }
    request.deadline.assertRemaining();
    const controller = new AbortController();
    let responseBody: ReadableStream<Uint8Array> | null = null;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let cancelled = false;
    let completed = false;
    const cancelBody = () => {
      if (cancelled || !responseBody) return;
      cancelled = true;
      // Cancellation is best effort and must not extend the overall deadline,
      // including when an underlying stream's cancel hook never settles.
      try { void (reader ? reader.cancel() : responseBody.cancel()).catch(() => undefined); }
      catch { /* Aborting the fetch below also terminates native transport. */ }
    };
    let rejectInterrupted: () => void = () => undefined;
    const interrupted = new Promise<never>((_resolve, reject) => {
      rejectInterrupted = () => reject(new SafeAiError('DEADLINE'));
    });
    const abort = () => { controller.abort(); cancelBody(); rejectInterrupted(); };
    request.deadline.signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, Math.max(1, request.deadline.remainingMs()));
    try {
      if (request.deadline.signal.aborted) throw new SafeAiError('DEADLINE');
      const response = await Promise.race([fetch(`${request.baseUrl}/chat/completions`, {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { Authorization: `Bearer ${request.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: request.model, messages: request.messages, stream: false,
          max_tokens: 800, reasoning_effort: 'none' }),
      }).then(value => {
        responseBody = value.body;
        if (controller.signal.aborted) { cancelBody(); throw new SafeAiError('DEADLINE'); }
        return value;
      }), interrupted]);
      const contentLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength > request.maxResponseBytes) throw new SafeAiError('INVALID_OUTPUT');
      if (!response.body) throw new SafeAiError('TRANSPORT');
      reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const part = await Promise.race([reader.read(), interrupted]);
        if (controller.signal.aborted) throw new SafeAiError('DEADLINE');
        if (part.done) break;
        size += part.value.byteLength;
        if (size > request.maxResponseBytes) throw new SafeAiError('INVALID_OUTPUT');
        chunks.push(part.value);
      }
      let body: string;
      try { body = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)); }
      catch { throw new SafeAiError('INVALID_OUTPUT'); }
      request.deadline.assertRemaining();
      completed = true;
      return { status: response.status, body, retryAfter: response.headers.get('retry-after') };
    } catch (error) {
      if (error instanceof SafeAiError) throw error;
      throw new SafeAiError(request.deadline.signal.aborted || controller.signal.aborted ? 'DEADLINE' : 'TRANSPORT');
    } finally {
      if (!completed) { controller.abort(); cancelBody(); }
      // releaseLock is synchronous and does not wait for cancellation hooks.
      reader?.releaseLock();
      clearTimeout(timer);
      request.deadline.signal.removeEventListener('abort', abort);
    }
  }
}
