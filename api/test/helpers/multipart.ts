/** Builds `multipart/form-data` bodies for `app.inject`, byte for byte, like a browser FormData. */
import { randomUUID } from 'node:crypto';

export interface FilePart {
  /** Form field name; `file` unless a test needs another one. */
  field?: string;
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface MultipartBody {
  payload: Buffer;
  headers: { 'content-type': string };
}

export function multipart(fields: Record<string, string>, files: FilePart[] = []): MultipartBody {
  const boundary = `----test${randomUUID().replace(/-/g, '')}`;
  const chunks: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  for (const file of files) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.field ?? 'file'}"; filename="${file.filename}"\r\n` +
          `Content-Type: ${file.contentType ?? 'text/csv'}\r\n\r\n`,
      ),
      Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf8'),
      Buffer.from('\r\n'),
    );
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(chunks), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}
