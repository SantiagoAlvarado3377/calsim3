import { createServer } from 'vite';
import electron from 'electron';
import { spawn } from 'node:child_process';

const server = await createServer({ server: { host: '127.0.0.1', port: 5173 } });
try {
  await server.listen();
  const { port } = server.httpServer.address();
  const child = spawn(electron, ['.'], {
    stdio: 'inherit',
    env: { ...process.env, CALSIM_DEV_URL: `http://127.0.0.1:${port}/` },
  });
  const stopDesktop = () => child.kill();
  process.once('SIGINT', stopDesktop);
  process.once('SIGTERM', stopDesktop);

  try {
    process.exitCode = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', code => resolve(code ?? 1));
    });
  } finally {
    process.removeListener('SIGINT', stopDesktop);
    process.removeListener('SIGTERM', stopDesktop);
  }
} catch (error) {
  console.error(`Could not start the CalSim 3 development app: ${error.message}`);
  process.exitCode = 1;
} finally {
  await server.close();
}
