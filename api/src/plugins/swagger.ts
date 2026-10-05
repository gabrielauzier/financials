import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

/**
 * Schema keyword for a field whose request schema must have no `type` (so Ajv does not coerce it)
 * but is documented with one: the transform below moves it to `type` in the generated document.
 */
export const OPENAPI_TYPE_KEY = 'x-openapi-type';

function documentTypes(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(documentTypes);
  if (node === null || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === OPENAPI_TYPE_KEY) out.type = value;
    else out[key] = documentTypes(value);
  }
  return out;
}

/** OpenAPI document from the route schemas (AD-001). UI at /docs, JSON at /docs/json; both public. */
export const swaggerPlugin = fp(async (app: FastifyInstance) => {
  await app.register(swagger, {
    transform: ({ schema, url }) => ({ schema: documentTypes(schema) as typeof schema, url }),
    openapi: {
      openapi: '3.0.3',
      info: { title: 'Financials API', version: '0.0.0' },
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
      security: [{ bearerAuth: [] }],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });
});
