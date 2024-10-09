import { build } from 'esbuild';

const AWS_SDK_PREFIX = /^@aws-sdk\//;

build({
  entryPoints: ['src/handler.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/handler.js',
  external: ['@aws-sdk/*'],
  minify: true,
  sourcemap: false
}).catch(() => process.exit(1));
