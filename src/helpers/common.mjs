import fs from 'fs';

/**
 * Load username mapping from configuration file
 * @returns {Object} Username mapping object
 */
export function loadUsernameMapping() {
  try {
    const configData = JSON.parse(
      fs.readFileSync('./username-mapping.json', 'utf8')
    );
    const mapping = configData.username_mapping || {};
    console.log('✅ Loaded username mapping configuration');
    return mapping;
  } catch (error) {
    throw new Error('⚠️  Could not load username-mapping.json');
  }
}

/**
 * Load repository whitelist from configuration file
 * @returns {Array} Repository whitelist array
 */
export function loadRepositoryWhitelist() {
  try {
    const whitelistData = JSON.parse(
      fs.readFileSync('./repo-whitelist.json', 'utf8')
    );
    const whitelist = whitelistData.repository_whitelist || [];
    console.log('✅ Loaded repository whitelist configuration');
    return whitelist;
  } catch (error) {
    throw new Error('⚠️  Could not load repo-whitelist.json');
  }
}

/**
 * Load repository whitelist for testing (with fallback)
 * @returns {Array} Repository whitelist array
 */
export function loadRepositoryWhitelistForTesting() {
  try {
    const whitelistData = JSON.parse(
      fs.readFileSync('./repo-whitelist.json', 'utf8')
    );
    const whitelist = whitelistData.repository_whitelist || [];
    console.log('✅ Loaded repository whitelist for testing');
    return whitelist;
  } catch (error) {
    console.warn(
      '⚠️  Could not load repo-whitelist.json, using default test repository'
    );
    return [];
  }
}

/**
 * Initialize Octokit client
 * @param {string} token - GitHub token
 * @param {string} baseUrl - GitHub API base URL (optional)
 * @returns {Promise<Octokit>} Initialized Octokit instance
 */
export async function initializeOctokit(
  token,
  baseUrl = 'https://api.github.com'
) {
  const { Octokit } = await import('@octokit/rest');
  return new Octokit({
    auth: token,
    baseUrl,
  });
}

/**
 * Update username references in release notes (only @username mentions)
 * @param {string} body - Release notes body
 * @param {Object} usernameMapping - Username mapping object
 * @returns {string} Updated release notes body
 */
export function updateUsernamesInReleaseNotes(body, usernameMapping) {
  if (!body) return body;

  let updatedBody = body;

  // Replace only @username references (mentions) but prevent recursive replacement
  for (const [oldUsername, newUsername] of Object.entries(usernameMapping)) {
    // Use negative lookahead to prevent matching if the new username is already present
    // This prevents @nghia-nguyen-4321 from being matched by @nghia-nguyen pattern
    const oldPattern = new RegExp(
      `@${oldUsername}(?!-${newUsername.split('-').slice(-1)[0]})\\b`,
      'g'
    );
    const newReference = `@${newUsername}`;
    updatedBody = updatedBody.replace(oldPattern, newReference);
  }

  return updatedBody;
}

/**
 * Get all releases for a specific repository
 * @param {Octokit} octokit - Octokit instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Array>} Array of releases
 */
export async function getAllReleases(octokit, owner, repo) {
  try {
    console.log(`Fetching releases for ${owner}/${repo}...`);
    const { data: releases } = await octokit.rest.repos.listReleases({
      owner,
      repo,
      per_page: 100,
    });
    return releases;
  } catch (error) {
    console.error(
      `Error fetching releases for ${owner}/${repo}:`,
      error.message
    );
    return [];
  }
}

/**
 * Add delay to avoid rate limiting
 * @param {number} ms - Delay in milliseconds
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
