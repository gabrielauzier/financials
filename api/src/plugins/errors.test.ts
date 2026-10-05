import Fastify, { type FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { describe, expect, it } from 'vitest';
import { AppError, errorsPlugin } from './errors.js';

async function appWith(register: (app: FastifyInstance) => void): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(errorsPlugin);
  register(app);
  await app.ready();
  return app;
}

describe('AppError', () => {
  it('produces the documented status and body', async () => {
    const app = await appWith((a) => {
      a.get('/boom', () => {
        throw new AppError('email_taken', 409, 'E-mail já cadastrado', 'email');
      });
    });
    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      error: { code: 'email_taken', message: 'E-mail já cadastrado', field: 'email' },
    });
  });

  it('omits field when none is given', async () => {
    const app = await appWith((a) => {
      a.get('/nope', () => {
        throw new AppError('unauthorized', 401, 'Sessão inválida');
      });
    });
    const res = await app.inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: { code: 'unauthorized', message: 'Sessão inválida' } });
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [409, 'conflict'],
    [422, 'unprocessable'],
  ])('maps status %i', async (status, code) => {
    const app = await appWith((a) => {
      a.get('/x', () => {
        throw new AppError(code, status, 'msg');
      });
    });
    const res = await app.inject({ method: 'GET', url: '/x' });
    expect(res.statusCode).toBe(status);
    expect(res.json().error.code).toBe(code);
  });
});

describe('validation errors', () => {
  const register = (a: FastifyInstance): void => {
    a.post(
      '/things',
      { schema: { body: Type.Object({ name: Type.String({ minLength: 1 }), age: Type.Integer() }) } },
      () => ({ ok: true }),
    );
  };

  it('returns 400 validation_error naming a missing field', async () => {
    const app = await appWith(register);
    const res = await app.inject({ method: 'POST', url: '/things', payload: { age: 3 } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation_error');
    expect(res.json().error.field).toBe('name');
  });

  it('returns the offending field for an invalid value', async () => {
    const app = await appWith(register);
    const res = await app.inject({
      method: 'POST',
      url: '/things',
      payload: { name: 'a', age: 'old' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.field).toBe('age');
  });
});

describe('unexpected errors', () => {
  it('returns 500 internal_error without stack or internals', async () => {
    const app = await appWith((a) => {
      a.get('/crash', () => {
        throw new Error('connection to db-secret-host:5432 refused');
      });
    });
    const res = await app.inject({ method: 'GET', url: '/crash' });
    expect(res.statusCode).toBe(500);
    expect(res.json().error.code).toBe('internal_error');
    expect(res.body).not.toContain('db-secret-host');
    expect(res.body).not.toContain('stack');
    expect(res.body).not.toMatch(/\bat .*\(/);
  });

  it('uses the same error shape for unknown routes (404)', async () => {
    const app = await appWith(() => {});
    const res = await app.inject({ method: 'GET', url: '/missing' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('not_found');
  });
});
