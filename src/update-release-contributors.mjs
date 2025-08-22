import { loadEnv } from './helpers/loadEnv.mjs';
import {
  loadUsernameMapping,
  loadRepositoryWhitelist,
  initializeOctokit,
  updateUsernamesInReleaseNotes,
  getAllReleases,
  delay,
} from './helpers/common.mjs';
import { createReleaseBackup, createBackupIndex } from './helpers/backup.mjs';

// Load environment variables
const { GITHUB_TOKEN, GITHUB_OWNER } = loadEnv([
  'GITHUB_TOKEN',
  'GITHUB_OWNER',
]);

// Load username mapping from configuration file
const USERNAME_MAPPING = loadUsernameMapping();

// Load repository whitelist
const REPOSITORY_WHITELIST = loadRepositoryWhitelist();

// Initialize Octokit
const octokit = await initializeOctokit(GITHUB_TOKEN);

/**
 * Get repositories from whitelist and verify they exist
 */
async function getWhitelistedRepositories(owner) {
  try {
    console.log(
      `Processing ${REPOSITORY_WHITELIST.length} whitelisted repositories...`
    );

    const verifiedRepos = [];

    for (const repoName of REPOSITORY_WHITELIST) {
      try {
        // Verify repository exists and is accessible
        const { data: repo } = await octokit.rest.repos.get({
          owner,
          repo: repoName,
        });

        verifiedRepos.push({
          name: repo.name,
          full_name: repo.full_name,
          private: repo.private,
          archived: repo.archived,
          disabled: repo.disabled,
        });

        console.log(`  ✅ ${repoName} - verified`);

        // Add delay to avoid rate limiting
        await delay(100);
      } catch (error) {
        if (error.status === 404) {
          console.log(
            `  ❌ ${repoName} - repository not found or not accessible`
          );
        } else {
          console.log(`  ⚠️  ${repoName} - error verifying: ${error.message}`);
        }
      }
    }

    return verifiedRepos;
  } catch (error) {
    console.error(`Error processing repository whitelist:`, error.message);
    return [];
  }
}

/**
 * Update a specific release
 */
async function updateRelease(owner, repo, releaseId, releaseData) {
  try {
    const updatedBody = updateUsernamesInReleaseNotes(
      releaseData.body,
      USERNAME_MAPPING
    );

    // Only update if there are actual changes
    if (updatedBody === releaseData.body) {
      console.log(
        `  No username updates needed for release ${releaseData.tag_name}`
      );
      return false;
    }

    console.log(`  Updating release ${releaseData.tag_name}...`);

    await octokit.rest.repos.updateRelease({
      owner,
      repo,
      release_id: releaseId,
      body: updatedBody,
    });

    console.log(`  ✅ Successfully updated release ${releaseData.tag_name}`);
    return true;
  } catch (error) {
    console.error(
      `  ❌ Error updating release ${releaseData.tag_name}:`,
      error.message
    );
    return false;
  }
}

/**
 * Backup release notes to file
 */
async function backupReleaseNotes(owner, repo, releases) {
  try {
    const backupDir = `./backups/${owner}/${repo}`;

    // Create backup using helper function
    const backupFile = createReleaseBackup(owner, repo, releases);

    return backupFile;
  } catch (error) {
    console.error(
      `  ❌ Error creating backup for ${owner}/${repo}:`,
      error.message
    );
    return null;
  }
}

/**
 * Process all releases for a repository
 */
async function processRepositoryReleases(owner, repo) {
  try {
    const releases = await getAllReleases(octokit, owner, repo);

    if (releases.length === 0) {
      console.log(`  No releases found for ${owner}/${repo}`);
      return { processed: 0, updated: 0 };
    }

    console.log(`  Found ${releases.length} releases`);

    // Backup releases before making any changes
    console.log(`  💾 Creating backup...`);
    const backupFile = await backupReleaseNotes(owner, repo, releases);

    let updatedCount = 0;
    for (const release of releases) {
      const wasUpdated = await updateRelease(owner, repo, release.id, release);
      if (wasUpdated) updatedCount++;

      // Add a small delay to avoid rate limiting
      await delay(100);
    }

    return { processed: releases.length, updated: updatedCount, backupFile };
  } catch (error) {
    console.error(
      `  ❌ Error processing releases for ${owner}/${repo}:`,
      error.message
    );
    return { processed: 0, updated: 0, error: true };
  }
}

/**
 * Main function to process all repositories and releases
 */
async function main() {
  if (!GITHUB_TOKEN) {
    console.error('❌ Please set GITHUB_TOKEN environment variable');
    process.exit(1);
  }

  console.log('🚀 Starting release contributor update process...');
  console.log(`📋 Username mappings:`, USERNAME_MAPPING);
  console.log(`📚 Repository whitelist:`, REPOSITORY_WHITELIST);
  console.log(`👤 Processing repositories for: ${GITHUB_OWNER}`);
  console.log('');

  try {
    const repos = await getWhitelistedRepositories(GITHUB_OWNER);

    if (repos.length === 0) {
      console.log('❌ No repositories found');
      return;
    }

    console.log(`📚 Found ${repos.length} repositories`);
    console.log('');

    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalErrors = 0;

    for (let i = 0; i < repos.length; i++) {
      const repo = repos[i];
      const status = [];
      if (repo.private) status.push('🔒 Private');
      if (repo.archived) status.push('📦 Archived');
      if (repo.disabled) status.push('🚫 Disabled');

      console.log(`[${i + 1}/${repos.length}] Processing ${repo.name}...`);
      if (status.length > 0) {
        console.log(`  📋 Status: ${status.join(', ')}`);
      }

      const result = await processRepositoryReleases(GITHUB_OWNER, repo.name);

      totalProcessed += result.processed;
      totalUpdated += result.updated;
      if (result.error) totalErrors++;

      console.log(
        `  📊 Summary: ${result.processed} processed, ${result.updated} updated`
      );
      if (result.backupFile) {
        console.log(`  💾 Backup saved to: ${result.backupFile}`);
      }
      console.log('');

      // Add delay between repositories to be respectful to GitHub's API
      if (i < repos.length - 1) {
        await delay(500);
      }
    }

    console.log('🎉 Process completed!');
    console.log(`📊 Final Summary:`);
    console.log(`   Repositories processed: ${repos.length}`);
    console.log(`   Total releases processed: ${totalProcessed}`);
    console.log(`   Total releases updated: ${totalUpdated}`);
    console.log(`   Errors encountered: ${totalErrors}`);
    console.log(`   Backups created in: ./backups/`);
    console.log('');
    console.log('💾 All release notes have been backed up before updating.');
    console.log(
      '   You can find the backup files in the ./backups/ directory.'
    );
    console.log(
      '   Each backup includes the original release data and can be used to restore if needed.'
    );

    // Create backup index
    console.log('');
    console.log('📋 Creating backup index...');
    createBackupIndex();
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
