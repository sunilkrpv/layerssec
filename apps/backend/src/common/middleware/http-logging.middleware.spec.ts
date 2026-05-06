import { HttpLoggingMiddleware } from './http-logging.middleware';
import { Logger } from '@nestjs/common';

describe('HttpLoggingMiddleware', () => {
  let middleware: HttpLoggingMiddleware;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    middleware = new HttpLoggingMiddleware();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  function makeReq(overrides: Partial<{ method: string; originalUrl: string; user: { id: string } }> = {}) {
    return { method: 'GET', originalUrl: '/api/projects', ...overrides } as any;
  }

  function makeRes(statusCode = 200) {
    const listeners: Record<string, (() => void)[]> = {};
    return {
      statusCode,
      on: (event: string, cb: () => void) => { (listeners[event] ??= []).push(cb); },
      emit: (event: string) => listeners[event]?.forEach((cb) => cb()),
    } as any;
  }

  it('calls next()', () => {
    const next = jest.fn();
    middleware.use(makeReq(), makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('logs the inbound request at info level', () => {
    const next = jest.fn();
    middleware.use(makeReq({ method: 'POST', originalUrl: '/api/ai/generate' }), makeRes(), next);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('POST /api/ai/generate'));
  });

  it('logs response at info level for 200', () => {
    const next = jest.fn();
    const res = makeRes(200);
    middleware.use(makeReq(), res, next);
    res.emit('finish');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('200'));
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logs response at error level for 500', () => {
    const next = jest.fn();
    const res = makeRes(500);
    middleware.use(makeReq(), res, next);
    res.emit('finish');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('500'));
    expect(logSpy).toHaveBeenCalledTimes(1); // only the inbound line
  });

  it('includes userId from req.user.id when present', () => {
    const next = jest.fn();
    const res = makeRes(200);
    middleware.use(makeReq({ user: { id: 'usr_abc' } }), res, next);
    res.emit('finish');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('usr_abc'));
  });

  it('falls back to anon when req.user is absent', () => {
    const next = jest.fn();
    const res = makeRes(200);
    middleware.use(makeReq(), res, next);
    res.emit('finish');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('anon'));
  });
});
