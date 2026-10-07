import { createServer, type Server, type Socket } from 'node:net';

export interface CapturedMail {
  from: string;
  to: string[];
  data: string;
}

/**
 * Minimal in-process SMTP listener for host integration tests. It speaks just
 * enough of the protocol for nodemailer and captures the DATA payload so a test
 * can follow the real emailed link. It starts unlistened so a test can first
 * exercise a transport failure.
 */
export class InProcessSmtpServer {
  private readonly server: Server;
  private readonly sockets = new Set<Socket>();
  readonly messages: CapturedMail[] = [];
  readonly authAttempts: string[] = [];
  private listening = false;

  constructor() {
    this.server = createServer((socket) => this.handle(socket));
    this.server.on('error', () => undefined);
  }

  listen(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(port, '127.0.0.1', () => {
        this.server.removeListener('error', reject);
        this.listening = true;
        resolve();
      });
    });
  }

  async waitFor(
    predicate: (mail: CapturedMail) => boolean,
    timeoutMs = 5000,
  ): Promise<CapturedMail> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const found = this.messages.find(predicate);
      if (found) {
        return found;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    throw new Error('Timed out waiting for an SMTP message');
  }

  async close(): Promise<void> {
    for (const socket of this.sockets) {
      socket.destroy();
    }
    if (!this.listening) {
      return;
    }
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private handle(socket: Socket): void {
    this.sockets.add(socket);
    socket.setEncoding('utf8');
    socket.write('220 localhost ESMTP\r\n');

    let buffer = '';
    let inData = false;
    let from = '';
    let to: string[] = [];
    let data = '';

    socket.on('data', (chunk: string) => {
      buffer += chunk;
      let index = buffer.indexOf('\r\n');
      while (index >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);

        if (inData) {
          if (line === '.') {
            inData = false;
            this.messages.push({ from, to, data });
            socket.write('250 OK\r\n');
          } else {
            data += `${line}\n`;
          }
        } else {
          const upper = line.toUpperCase();
          if (upper.startsWith('EHLO') || upper.startsWith('HELO')) {
            socket.write(
              '250-localhost\r\n250-AUTH PLAIN\r\n250 SIZE 10485760\r\n',
            );
          } else if (upper.startsWith('AUTH ')) {
            this.authAttempts.push(line);
            socket.write('235 2.7.0 Authentication successful\r\n');
          } else if (upper.startsWith('MAIL FROM:')) {
            from = line.slice(line.indexOf(':') + 1).trim();
            socket.write('250 OK\r\n');
          } else if (upper.startsWith('RCPT TO:')) {
            to.push(line.slice(line.indexOf(':') + 1).trim());
            socket.write('250 OK\r\n');
          } else if (upper === 'DATA') {
            inData = true;
            data = '';
            socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
          } else if (upper === 'RSET') {
            from = '';
            to = [];
            data = '';
            socket.write('250 OK\r\n');
          } else if (upper === 'QUIT') {
            socket.write('221 Bye\r\n');
            socket.end();
          } else {
            socket.write('250 OK\r\n');
          }
        }

        index = buffer.indexOf('\r\n');
      }
    });

    socket.on('close', () => this.sockets.delete(socket));
    socket.on('error', () => this.sockets.delete(socket));
  }
}

export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}
