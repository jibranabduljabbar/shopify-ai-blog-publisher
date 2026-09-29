import ts from 'typescript';
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { createRequire } from 'node:module';

// Compile the small server-only test surface in-process; no helper executables.
function compile(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) compile(file);
    else if (file.endsWith('.ts')) {
      const output = join('.test-build', relative('.', file).replace(/\.ts$/, '.js'));
      mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, ts.transpileModule(readFileSync(file, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true }
      }).outputText);
    }
  }
}
compile('lib');
compile('app/api');
createRequire(import.meta.url)('../tests/pipeline.test.cjs');
