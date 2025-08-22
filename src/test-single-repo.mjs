import { loadEnv } from './helpers/loadEnv.mjs';
import {
  initializeOctokit,
  loadUsernameMapping,
  loadRepositoryWhitelistForTesting,
  updateUsernamesInReleaseNotes,
  getAllReleases,
} from './helpers/common.mjs';
import { createTestBackup } from './helpers/backup.mjs';

// Load environment variables
const { GITHUB_TOKEN, GITHUB_OWNER } = loadEnv([
  'GITHUB_TOKEN',
  'GITHUB_OWNER',
]);

// Load repository whitelist for testing
const REPOSITORY_WHITELIST = loadRepositoryWhitelistForTesting();

// Use first repository from whitelist for testing
const TEST_REPO = REPOSITORY_WHITELIST[0];
if (!TEST_REPO) {
  console.error('❌ No test repository found in whitelist');
  process.exit(1);
}

// Load username mapping from configuration file
const USERNAME_MAPPING = loadUsernameMapping();

/**
 * Test update without actually making changes
 */
async function testUpdate(releaseData) {
  const updatedBody = updateUsernamesInReleaseNotes(
    releaseData.body,
    USERNAME_MAPPING
  );

  if (updatedBody === releaseData.body) {
    console.log(
      `  ✅ No username updates needed for release ${releaseData.tag_name}`
    );
    return false;
  }

  console.log(`  🔄 Release ${releaseData.tag_name} would be updated:`);

  // Show a preview of the changes
  const oldLines = releaseData.body.split('\n');
  const newLines = updatedBody.split('\n');

  console.log(`     Preview of changes:`);
  for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
    const oldLine = oldLines[i] || '';
    const newLine = newLines[i] || '';

    if (oldLine !== newLine) {
      console.log(`       - ${oldLine}`);
      console.log(`       + ${newLine}`);
    }
  }

  return true;
}

/**
 * Main test function
 */
async function main() {
  if (!GITHUB_TOKEN) {
    console.error(
      '❌ Please set GITHUB_TOKEN environment variable or update the script with your token'
    );
    process.exit(1);
  }

  console.log('🧪 Testing release contributor update on single repository...');
  console.log(`📋 Username mappings:`, USERNAME_MAPPING);
  console.log(`📚 Repository whitelist:`, REPOSITORY_WHITELIST);
  console.log(`👤 Testing repository: ${GITHUB_OWNER}/${TEST_REPO}`);
  console.log('');

  try {
    const octokit = await initializeOctokit(GITHUB_TOKEN);
    const releases = await getAllReleases(octokit, GITHUB_OWNER, TEST_REPO);

    if (releases.length === 0) {
      console.log('❌ No releases found in test repository');
      return;
    }

    console.log(`📚 Found ${releases.length} releases to test`);
    console.log('');

    // Create test backup to show backup structure
    console.log(`💾 Creating test backup to show backup structure...`);
    createTestBackup(GITHUB_OWNER, TEST_REPO, releases);
    console.log('');

    let needsUpdateCount = 0;

    for (const release of releases) {
      console.log(`Testing release: ${release.tag_name}`);
      const needsUpdate = await testUpdate(release);
      if (needsUpdate) needsUpdateCount++;
      console.log('');
    }

    console.log('🧪 Test completed!');
    console.log(`📊 Test Summary:`);
    console.log(`   Releases tested: ${releases.length}`);
    console.log(`   Releases that need updates: ${needsUpdateCount}`);

    if (needsUpdateCount > 0) {
      console.log('');
      console.log('💡 To actually update these releases, run:');
      console.log('   node update-release-contributors.mjs');
    } else {
      console.log('');
      console.log('🎉 All releases are already up to date!');
    }
  } catch (error) {
    console.error('❌ Test error:', error.message);
    process.exit(1);
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
