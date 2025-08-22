import { Octokit } from '@octokit/rest';
import fs from 'fs';

// Load environment variables
const { GITHUB_TOKEN } = loadEnv(['GITHUB_TOKEN']);

// Initialize Octokit
const octokit = new Octokit({
  auth: GITHUB_TOKEN,
  baseUrl: 'https://api.github.com',
});

/**
 * List available backups
 */
function listAvailableBackups() {
  try {
    if (!fs.existsSync('./backups')) {
      console.log('❌ No backups directory found');
      return [];
    }

    const backupIndexFile = './backups/backup-index.json';
    if (fs.existsSync(backupIndexFile)) {
      const indexData = JSON.parse(fs.readFileSync(backupIndexFile, 'utf8'));
      return indexData.repositories || [];
    }

    // Fallback: scan backups directory manually
    const backups = [];
    const ownerDirs = fs
      .readdirSync('./backups')
      .filter(dir => fs.statSync(`./backups/${dir}`).isDirectory());

    for (const ownerDir of ownerDirs) {
      const repoDirs = fs
        .readdirSync(`./backups/${ownerDir}`)
        .filter(dir =>
          fs.statSync(`./backups/${ownerDir}/${dir}`).isDirectory()
        );

      for (const repoDir of repoDirs) {
        const backupFiles = fs
          .readdirSync(`./backups/${ownerDir}/${repoDir}`)
          .filter(file => file.endsWith('.json'))
          .map(file => ({
            file: file,
            path: `./backups/${ownerDir}/${repoDir}/${file}`,
            size: fs.statSync(`./backups/${ownerDir}/${repoDir}/${file}`).size,
          }));

        backups.push({
          owner: ownerDir,
          repo: repoDir,
          backup_files: backupFiles,
        });
      }
    }

    return backups;
  } catch (error) {
    console.error('❌ Error listing backups:', error.message);
    return [];
  }
}

/**
 * Restore a specific release from backup
 */
async function restoreRelease(owner, repo, releaseId, backupData) {
  try {
    console.log(`  🔄 Restoring release ${backupData.tag_name}...`);

    await octokit.rest.repos.updateRelease({
      owner,
      repo,
      release_id: releaseId,
      body: backupData.body,
    });

    console.log(`  ✅ Successfully restored release ${backupData.tag_name}`);
    return true;
  } catch (error) {
    console.error(
      `  ❌ Error restoring release ${backupData.tag_name}:`,
      error.message
    );
    return false;
  }
}

/**
 * Restore all releases for a repository from backup
 */
async function restoreRepositoryFromBackup(owner, repo, backupFile) {
  try {
    console.log(`📚 Restoring repository ${owner}/${repo} from backup...`);

    // Read backup file
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

    if (!backupData.releases || backupData.releases.length === 0) {
      console.log(`  ❌ No releases found in backup file`);
      return { processed: 0, restored: 0 };
    }

    console.log(`  Found ${backupData.releases.length} releases to restore`);

    // Get current releases to match by tag name
    const { data: currentReleases } = await octokit.rest.repos.listReleases({
      owner,
      repo,
      per_page: 100,
    });

    let restoredCount = 0;
    for (const backupRelease of backupData.releases) {
      // Find matching current release by tag name
      const currentRelease = currentReleases.find(
        r => r.tag_name === backupRelease.tag_name
      );

      if (!currentRelease) {
        console.log(
          `  ⚠️  Release ${backupRelease.tag_name} not found in current repository`
        );
        continue;
      }

      const wasRestored = await restoreRelease(
        owner,
        repo,
        currentRelease.id,
        backupRelease
      );
      if (wasRestored) restoredCount++;

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return { processed: backupData.releases.length, restored: restoredCount };
  } catch (error) {
    console.error(
      `  ❌ Error restoring repository ${owner}/${repo}:`,
      error.message
    );
    return { processed: 0, restored: 0, error: true };
  }
}

/**
 * Main restore function
 */
async function main() {
  if (!GITHUB_TOKEN) {
    console.error(
      '❌ Please set GITHUB_TOKEN environment variable or update the script with your token'
    );
    process.exit(1);
  }

  console.log('🔄 Release Notes Restore Tool');
  console.log('==============================');
  console.log('');

  try {
    const availableBackups = listAvailableBackups();

    if (availableBackups.length === 0) {
      console.log('❌ No backups found');
      return;
    }

    console.log(
      `📋 Found ${availableBackups.length} repositories with backups:`
    );
    console.log('');

    // Display available backups
    availableBackups.forEach((backup, index) => {
      console.log(`${index + 1}. ${backup.owner}/${backup.repo}`);
      backup.backup_files.forEach(file => {
        console.log(`   📁 ${file.file} (${(file.size / 1024).toFixed(1)} KB)`);
      });
      console.log('');
    });

    // Ask user which repository to restore
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = query =>
      new Promise(resolve => rl.question(query, resolve));

    const choice = await question(
      `Enter the number of the repository to restore (1-${availableBackups.length}): `
    );
    const selectedIndex = parseInt(choice) - 1;

    if (selectedIndex < 0 || selectedIndex >= availableBackups.length) {
      console.log('❌ Invalid selection');
      rl.close();
      return;
    }

    const selectedBackup = availableBackups[selectedIndex];

    // Ask for confirmation
    const confirm = await question(
      `Are you sure you want to restore ${selectedBackup.owner}/${selectedBackup.repo}? This will overwrite current release notes. (yes/no): `
    );

    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log('Restore cancelled.');
      rl.close();
      return;
    }

    // Use the most recent backup file
    const backupFile = selectedBackup.backup_files[0].path;

    console.log('');
    console.log(`🚀 Starting restore process...`);
    console.log(`📁 Using backup file: ${backupFile}`);
    console.log('');

    const result = await restoreRepositoryFromBackup(
      selectedBackup.owner,
      selectedBackup.repo,
      backupFile
    );

    console.log('');
    console.log('🎉 Restore completed!');
    console.log(`📊 Restore Summary:`);
    console.log(`   Releases processed: ${result.processed}`);
    console.log(`   Releases restored: ${result.restored}`);

    rl.close();
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the restore tool
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
