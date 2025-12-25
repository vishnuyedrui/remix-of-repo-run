export interface PackageJson {
  name?: string;
  engines?: {
    node?: string;
  };
  scripts?: {
    start?: string;
    dev?: string;
    build?: string;
  };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export function detectPackageManager(files: string[]): 'npm' | 'yarn' | 'pnpm' {
  if (files.includes('pnpm-lock.yaml')) return 'pnpm';
  if (files.includes('yarn.lock')) return 'yarn';
  return 'npm';
}

export function parseNodeVersion(engineString?: string): string {
  if (!engineString) return '20';
  
  // Extract major version from strings like ">=18", "^18.0.0", "20.x", "20"
  const match = engineString.match(/(\d+)/);
  return match ? match[1] : '20';
}

export function generateNodeDockerfile(
  packageJson: PackageJson,
  packageManager: 'npm' | 'yarn' | 'pnpm'
): string {
  const nodeVersion = parseNodeVersion(packageJson.engines?.node);
  const hasDevScript = !!packageJson.scripts?.dev;
  const hasBuildScript = !!packageJson.scripts?.build;
  const hasStartScript = !!packageJson.scripts?.start;

  const installCmd = {
    npm: 'npm ci --only=production',
    yarn: 'yarn install --frozen-lockfile --production',
    pnpm: 'pnpm install --frozen-lockfile --prod',
  }[packageManager];

  const devInstallCmd = {
    npm: 'npm ci',
    yarn: 'yarn install --frozen-lockfile',
    pnpm: 'pnpm install --frozen-lockfile',
  }[packageManager];

  // Determine start command
  let startCmd = 'node index.js';
  if (hasStartScript) {
    startCmd = packageManager === 'npm' ? 'npm start' : `${packageManager} start`;
  } else if (hasDevScript && !hasBuildScript) {
    startCmd = packageManager === 'npm' ? 'npm run dev' : `${packageManager} dev`;
  }

  // Build stage for projects with build scripts
  if (hasBuildScript) {
    return `# Multi-stage build
FROM node:${nodeVersion}-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
${packageManager !== 'npm' ? `COPY ${packageManager === 'yarn' ? 'yarn.lock' : 'pnpm-lock.yaml'} ./` : ''}
RUN ${devInstallCmd}

# Copy source and build
COPY . .
RUN ${packageManager === 'npm' ? 'npm run build' : `${packageManager} build`}

# Production stage
FROM node:${nodeVersion}-alpine
WORKDIR /app

# Copy built assets and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/build ./build
COPY package*.json ./
${packageManager !== 'npm' ? `COPY ${packageManager === 'yarn' ? 'yarn.lock' : 'pnpm-lock.yaml'} ./` : ''}
RUN ${installCmd}

# Expose port (Railway sets PORT env var)
ENV PORT=3000
EXPOSE 3000

# Start the app
CMD ["${startCmd.split(' ')[0]}", "${startCmd.split(' ').slice(1).join('", "')}"]
`;
  }

  // Simple Dockerfile for projects without build step
  return `FROM node:${nodeVersion}-alpine
WORKDIR /app

# Copy package files
COPY package*.json ./
${packageManager !== 'npm' ? `COPY ${packageManager === 'yarn' ? 'yarn.lock' : 'pnpm-lock.yaml'} ./` : ''}

# Install dependencies
RUN ${installCmd}

# Copy source
COPY . .

# Expose port (Railway sets PORT env var)
ENV PORT=3000
EXPOSE 3000

# Start the app
CMD ${JSON.stringify(startCmd.split(' '))}
`;
}

export function generateStaticDockerfile(): string {
  return `FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
}

export function generatePythonDockerfile(): string {
  return `FROM python:3.11-slim
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
ENV PORT=8000
EXPOSE 8000

# Default command (adjust based on your app)
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
`;
}
