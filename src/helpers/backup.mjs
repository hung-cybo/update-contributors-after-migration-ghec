import fs from 'fs';

/**
 * Create backup directory structure
 * @param {string} backupPath - Backup directory path
 */
export function createBackupDirectory(backupPath) {
  const dirs = backupPath.split('/');
  let currentPath = '';

  for (const dir of dirs) {
    if (dir) {
      currentPath += (currentPath ? '/' : '') + dir;
      if (!fs.existsSync(currentPath)) {
        fs.mkdirSync(currentPath, {recursive: true});
      }
    }
  }
}

/**
 * Generate timestamp for backup files
 * @returns {string} Formatted timestamp string
 */
export function generateBackupTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Create backup of releases
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {Array} releases - Array of releases to backup
 * @param {Object} options - Backup options
 * @param {string} options.type - Backup type ('test' or 'release')
 * @param {string} options.note - Optional note for test backups
 * @returns {string} Path to the backup file
 */
export function createBackup(owner, repo, releases, options = {}) {
  try {
    const {type = 'release', note} = options;
    const isTest = type === 'test';

    // Determine backup directory and filename
    const baseDir = isTest ? './test-backups' : './backups';
    const backupDir = `${baseDir}/${owner}/${repo}`;
    const filename = isTest ? 'test-backup' : 'releases-backup';

    // Create backup directory structure
    createBackupDirectory(backupDir);

    // Create backup file with timestamp
    const timestamp = generateBackupTimestamp();
    const backupFile = `${backupDir}/${filename}-${timestamp}.json`;

    // Prepare backup data
    const backupData = {
      repository: `${owner}/${repo}`,
      backup_timestamp: new Date().toISOString(),
      total_releases: releases.length,
      releases: releases.map(release => ({
        id: release.id,
        tag_name: release.tag_name,
        name: release.name,
        body: release.body,
        created_at: release.created_at,
        published_at: release.published_at,
        html_url: release.html_url,
      })),
    };

    // Add test-specific fields
    if (isTest) {
      backupData.note =
        note || 'This is a TEST backup - no actual updates were made';
    }

    // Write backup file
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));

    // Log appropriate message
    if (isTest) {
      console.log(`  💾 Test backup created: ${backupFile}`);
    } else {
      console.log(`  💾 Backup created: ${backupFile}`);
    }

    return backupFile;
  } catch (error) {
    const backupType = options.type === 'test' ? 'test backup' : 'backup';
    console.error(`  ❌ Error creating ${backupType}:`, error.message);
    return null;
  }
}

/**
 * Create test backup to show backup structure
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {Array} releases - Array of releases to backup
 * @returns {string} Path to the backup file
 */
export function createTestBackup(owner, repo, releases) {
  return createBackup(owner, repo, releases, {type: 'test'});
}

/**
 * Create backup of releases before updating
 * @param {string} owner - Repository owner
 * @param {string} repo - Array of releases to backup
 * @returns {string} Path to the backup file
 */
export function createReleaseBackup(owner, repo, releases) {
  return createBackup(owner, repo, releases, {type: 'release'});
}

/**
 * Create master backup index
 * @returns {string|null} Path to the backup index file or null if failed
 */
export function createBackupIndex() {
  try {
    const backupIndexFile = './backups/backup-index.json';
    const backupIndex = {
      created_at: new Date().toISOString(),
      total_repositories: 0,
      total_releases: 0,
      repositories: [],
    };

    if (fs.existsSync('./backups')) {
      const ownerDirs = fs
        .readdirSync('./backups')
        .filter(
          dir =>
            fs.statSync(`./backups/${dir}`).isDirectory() &&
            dir !== 'backup-index.json',
        );

      for (const ownerDir of ownerDirs) {
        const repoDirs = fs
          .readdirSync(`./backups/${ownerDir}`)
          .filter(dir =>
            fs.statSync(`./backups/${ownerDir}/${dir}`).isDirectory(),
          );

        for (const repoDir of repoDirs) {
          const backupFiles = fs
            .readdirSync(`./backups/${ownerDir}/${repoDir}`)
            .filter(file => file.endsWith('.json'))
            .map(file => ({
              file: file,
              path: `./backups/${ownerDir}/${repoDir}/${file}`,
              size: fs.statSync(`./backups/${ownerDir}/${repoDir}/${file}`)
                .size,
            }));

          backupIndex.repositories.push({
            owner: ownerDir,
            repo: repoDir,
            backup_files: backupFiles,
          });

          backupIndex.total_repositories++;
        }
      }
    }

    fs.writeFileSync(backupIndexFile, JSON.stringify(backupIndex, null, 2));
    console.log(`📋 Backup index created: ${backupIndexFile}`);

    return backupIndexFile;
  } catch (error) {
    console.error('❌ Error creating backup index:', error.message);
    return null;
  }
}

/**
 * Load backup data from file
 * @param {string} backupFilePath - Path to the backup file
 * @returns {Object|null} Backup data object or null if failed
 */
export function loadBackupData(backupFilePath) {
  try {
    const backupContent = fs.readFileSync(backupFilePath, 'utf8');
    return JSON.parse(backupContent);
  } catch (error) {
    console.error(
      `❌ Error loading backup file ${backupFilePath}:`,
      error.message,
    );
    return null;
  }
}

/**
 * List all available backups
 * @returns {Array} Array of backup information
 */
export function listAvailableBackups() {
  try {
    const backups = [];

    if (fs.existsSync('./backups')) {
      const ownerDirs = fs
        .readdirSync('./backups')
        .filter(
          dir =>
            fs.statSync(`./backups/${dir}`).isDirectory() &&
            dir !== 'backup-index.json',
        );

      for (const ownerDir of ownerDirs) {
        const repoDirs = fs
          .readdirSync(`./backups/${ownerDir}`)
          .filter(dir =>
            fs.statSync(`./backups/${ownerDir}/${dir}`).isDirectory(),
          );

        for (const repoDir of repoDirs) {
          const backupFiles = fs
            .readdirSync(`./backups/${ownerDir}/${repoDir}`)
            .filter(file => file.endsWith('.json'))
            .map(file => ({
              file: file,
              path: `./backups/${ownerDir}/${repoDir}/${file}`,
              size: fs.statSync(`./backups/${ownerDir}/${repoDir}/${file}`)
                .size,
              timestamp: file
                .replace('releases-backup-', '')
                .replace('.json', ''),
            }));

          backups.push({
            owner: ownerDir,
            repo: repoDir,
            backup_files: backupFiles,
          });
        }
      }
    }

    return backups;
  } catch (error) {
    console.error('❌ Error listing backups:', error.message);
    return [];
  }
}
