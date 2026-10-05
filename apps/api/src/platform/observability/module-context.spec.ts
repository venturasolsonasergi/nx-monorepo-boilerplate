import pino from 'pino';
import { PinoLogger } from 'nestjs-pino';
import { createLoggerParams } from './logging.config';
import {
  createModuleLogger,
  moduleForPath,
  moduleForRequest,
  routeTemplate,
} from './module-context';

interface MemoryStream {
  write(chunk: string): void;
}

function capture(): {
  stream: MemoryStream;
  records: () => Record<string, unknown>[];
} {
  const chunks: string[] = [];
  return {
    stream: {
      write(chunk: string): void {
        chunks.push(chunk);
      },
    },
    records: () =>
      chunks
        .join('')
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

describe('module context', () => {
  describe('moduleForPath', () => {
    it('maps service prefixes to their module', () => {
      expect(moduleForPath('/auth')).toBe('auth');
      expect(moduleForPath('/auth/login')).toBe('auth');
      expect(moduleForPath('/users/health')).toBe('users');
      expect(moduleForPath('/orders')).toBe('orders');
      expect(moduleForPath('/')).toBe('api');
      expect(moduleForPath('/unknown/route')).toBe('api');
    });

    it('ignores query strings and fragments', () => {
      expect(moduleForPath('/users?token=secret')).toBe('users');
      expect(moduleForPath('/orders#section')).toBe('orders');
    });
  });

  describe('moduleForRequest', () => {
    it('derives the module from the request path', () => {
      expect(moduleForRequest({ url: '/auth/login' })).toBe('auth');
      expect(moduleForRequest({})).toBe('api');
    });

    it('prefers originalUrl when middleware mutated url', () => {
      expect(
        moduleForRequest({ url: '/login', originalUrl: '/auth/login' }),
      ).toBe('auth');
    });
  });

  describe('routeTemplate', () => {
    it('returns a route template instead of raw values', () => {
      expect(
        routeTemplate({ baseUrl: '', route: { path: '/users/:id' } }),
      ).toBe('/users/:id');
      expect(
        routeTemplate({ baseUrl: '/api', route: { path: '/users' } }),
      ).toBe('/api/users');
    });

    it('ignores wildcard middleware routes and keeps the owning base path', () => {
      expect(
        routeTemplate({
          originalUrl: '/auth/login',
          baseUrl: '/auth',
          route: { path: '/{*splat}' },
        }),
      ).toBe('/auth');
      expect(
        routeTemplate({
          originalUrl: '/users',
          baseUrl: '/users',
          route: { path: '/{*splat}' },
        }),
      ).toBe('/users');
    });

    it('returns undefined when no route matched', () => {
      expect(routeTemplate({ url: '/missing' })).toBeUndefined();
    });
  });

  describe('createModuleLogger', () => {
    it('adds a stable module binding and optional component', () => {
      const output = capture();
      const base = pino({ base: { service: 'api' } }, output.stream);

      const logger = createModuleLogger(base, 'orders', 'checkout');
      logger.info('event');

      expect(output.records()[0]).toMatchObject({
        service: 'api',
        module: 'orders',
        component: 'checkout',
        msg: 'event',
      });
    });

    it('inherits the shared logger configuration without a new one', () => {
      const output = capture();
      const base = pino(
        { base: { service: 'api' }, level: 'warn' },
        output.stream,
      );
      const logger = createModuleLogger(base, 'users');

      logger.info('suppressed');
      logger.warn('emitted');

      const outputText = JSON.stringify(output.records());
      expect(outputText).not.toContain('suppressed');
      expect(outputText).toContain('emitted');
    });
  });

  describe('request context inheritance', () => {
    it('binds requestId, module, and component on request-scoped entries', () => {
      const output = capture();
      const logger = new PinoLogger(
        createLoggerParams(
          { NODE_ENV: 'production', LOG_LEVEL: 'info' },
          output.stream,
        ),
      );

      logger.runInContext(
        () => {
          logger.assign({ module: 'auth', component: 'signup' });
          logger.info('request scoped');
        },
        { bindings: { requestId: 'req-1' } },
      );

      expect(output.records()[0]).toMatchObject({
        service: 'api',
        environment: 'production',
        requestId: 'req-1',
        module: 'auth',
        component: 'signup',
        msg: 'request scoped',
      });
    });
  });
});
