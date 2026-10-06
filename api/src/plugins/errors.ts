import type { FastifyError, FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

export class AppError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

interface ErrorBody {
  error: { code: string; message: string; field?: string };
}

function body(code: string, message: string, field?: string): ErrorBody {
  return { error: { code, message, ...(field === undefined ? {} : { field }) } };
}

function validationField(error: FastifyError): string | undefined {
  const issue = error.validation?.[0];
  if (!issue) return undefined;
  const missing = (issue.params as { missingProperty?: unknown } | undefined)?.missingProperty;
  if (typeof missing === 'string') return missing;
  const segments = issue.instancePath.split('/').filter(Boolean);
  return segments.at(-1);
}

export const errorsPlugin = fp(async (app: FastifyInstance) => {
  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send(body('not_found', 'Not found')),
  );

  app.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.status).send(body(error.code, error.message, error.field));
    }
    if ('validation' in error && error.validation) {
      return reply
        .status(400)
        .send(body('validation_error', error.message, validationField(error)));
    }
    if (error.statusCode !== undefined && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.status(error.statusCode).send(body('bad_request', error.message));
    }
    // Never log the raw error: Postgres errors carry `detail` with the offending row's values.
    request.log.error({ err: safeErrorFields(error) }, 'unhandled error');
    return reply.status(500).send(body('internal_error', 'Internal server error'));
  });
});

/** Error fields that are safe to log: no `detail`, `where`, query text or parameters. */
function safeErrorFields(error: FastifyError): Record<string, unknown> {
  const fields = error as unknown as Record<string, unknown>;
  return {
    type: error.name,
    message: error.message,
    code: fields.code,
    constraint: fields.constraint_name,
    table: fields.table_name,
    stack: error.stack,
  };
}
