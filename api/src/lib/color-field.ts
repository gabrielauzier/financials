import { Type, type TUnsafe } from '@sinclair/typebox';
import { AppError } from '../plugins/errors.js';
import { OPENAPI_TYPE_KEY } from '../plugins/swagger.js';
import { COLOR_KEYS, isColorKey, type ColorKey } from './palette.js';

/** `color` in a response: one of the palette keys. */
export const ColorResponse: TUnsafe<ColorKey> = Type.Unsafe<ColorKey>({ type: 'string', enum: [...COLOR_KEYS] });

// Ajv coerces `null` to "" and numbers to strings for `type: 'string'`, which would turn a wrong JSON
// type into a 422. The request schema therefore has no `type` (the handler answers 400 for a non-string)
// and carries `x-openapi-type`, which the swagger transform turns back into `type: string`.
export const ColorInput: TUnsafe<string> = Type.Unsafe<string>({
  description: `One of: ${COLOR_KEYS.join(', ')}`,
  [OPENAPI_TYPE_KEY]: 'string',
});

/** A palette key: a wrong JSON type is 400, a string outside the palette is 422 (field `color`). */
export function validColor(value: unknown): ColorKey {
  if (typeof value !== 'string') {
    throw new AppError('validation_error', 400, 'color must be a string', 'color');
  }
  if (!isColorKey(value)) {
    throw new AppError('validation_error', 422, 'color must be one of the palette keys', 'color');
  }
  return value;
}
