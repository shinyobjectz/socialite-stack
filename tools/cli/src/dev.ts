import type { PackageName } from '@affine-tools/utils/workspace';

import { Option, PackageSelectorCommand } from './command';

export class DevCommand extends PackageSelectorCommand {
  static override paths = [['dev'], ['d']];

  protected override availablePackages: PackageName[] = [
    '@affine/web',
    '@affine/server',
    '@affine/electron',
    '@affine/electron-renderer',
    '@affine/mobile',
    '@affine/ios',
    '@affine/android',
    '@affine/admin',
  ];

  protected deps = Option.Boolean('--deps', {
    description: 'Run dev with dependencies',
  });

  protected all = Option.Boolean('--all', {
    description: 'Run all core services (web, server, convex)',
  });

  async execute() {
    // Start Cloud Convex watch immediately as it's required for all platforms
    this.logger.info('Starting Cloud Convex watch in background...');

    // this.spawn returns a ChildProcess, not a Promise, so we don't use .catch()
    try {
      this.spawn('bun', ['run', '--cwd', 'packages/convex', 'dev']);
    } catch (e) {
      this.logger.error('Failed to spawn Convex:', e);
    }

    if (this.all) {
      this.logger.info('Starting all core services...');

      // Start Server
      try {
        this.spawn('bun', ['run', 'affine', 'dev', '@affine/server']);
      } catch (e) {
        this.logger.error('Failed to spawn Server:', e);
      }

      // Start Web (this one will block and keep the process alive)
      await this.cli.run(['@affine/web', 'dev']);
      return;
    }

    const name = await this.getPackage();
    const args = [];

    if (this.deps) {
      args.push('--deps');
    }

    args.push(name, 'dev');

    await this.cli.run(args);
  }
}
