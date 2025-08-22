# Release Contributor Update Script

This script helps you update release notes across your repositories to fix contributor usernames after migrating from GitHub Enterprise Server (GHES) to GitHub Enterprise Cloud (GHEC).

## What it does

- Processes only repositories specified in a whitelist (instead of all repositories)
- Gets all releases for each whitelisted repository
- Updates release notes content by replacing old usernames with new ones
- **Only updates `@username` mentions (usernames starting with @)**
- **Does NOT update standalone usernames (without @)**
- **Does NOT modify release metadata, tags, or other release properties**
- Provides detailed logging and progress tracking
- Respects GitHub API rate limits
- Verifies repository accessibility before processing

## Prerequisites

1. **GitHub Token**: You need a GitHub Personal Access Token with the following permissions:
   - `repo` (Full control of private repositories)
   - `read:org` (if updating organization repositories)

2. **Node.js**: Make sure you have Node.js installed (version 14 or higher)

3. **Environment Variables**: Configure your environment variables in a `.env` file

## Setup

1. **Clone or download this repository**

2. **Install dependencies** (if not already installed):

   ```bash
   npm install
   ```

3. **Configure username mappings**:
   Edit `username-mapping.json` to add your username mappings:

   ```json
   {
     "username_mapping": {
       "old-username-1": "new-username-1",
       "old-username-2": "new-username-2"
     }
   }
   ```

4. **Configure repository whitelist**:
   Edit `repo-whitelist.json` to specify which repositories to process:

   ```json
   {
     "repository_whitelist": ["repo-name-1", "repo-name-2", "repo-name-3"]
   }
   ```

5. **Configure environment variables**:
   Create a `.env` file in your project root with the following variables:

   ```bash
   # Required: GitHub Personal Access Token
   GITHUB_TOKEN=your_github_personal_access_token_here

   # Required: GitHub username or organization name
   GITHUB_OWNER=your_github_username_or_org_name

   ```

## Usage

### Run the script using npm scripts (recommended):

```bash
# Update all repositories in the whitelist
npm run update

# Test updates on a single repository first
npm run update:test

# Restore from backup if needed
npm run restore-from-backup
```

### Run the script directly:

```bash
node src/update-release-contributors.mjs
```

## What the script will do

1. **Load whitelist**: Reads the repository whitelist from `repo-whitelist.json`
2. **Verify repositories**: Checks that each whitelisted repository exists and is accessible
3. **Create backups**: Automatically backs up all release notes before making changes
4. **Process each repository**: For each whitelisted repo, fetches all releases
5. **Update release notes**: Updates only the release notes content with corrected usernames
6. **Progress tracking**: Shows detailed progress and summary
7. **Error handling**: Continues processing even if some updates fail
8. **Create backup index**: Generates a master index of all backups created

## Safety features

- **Automatic backups**: Creates complete backups of all release notes before making any changes
- **Dry-run mode**: The script shows what would be updated before making changes
- **Rate limiting**: Built-in delays to respect GitHub API limits
- **Error handling**: Continues processing even if individual updates fail
- **Change detection**: Only updates releases that actually need changes
- **Detailed logging**: Shows exactly what's being updated
- **Restore capability**: Built-in restore tool to rollback changes if needed

## Backup and Restore

### Automatic Backups

The script automatically creates comprehensive backups before making any changes:

- **Backup location**: `./backups/{owner}/{repo}/releases-backup-{timestamp}.json`
- **Backup contents**: Complete release data including body, metadata, and timestamps
- **Backup index**: Master index file at `./backups/backup-index.json` listing all backups

### Restore from Backup

If you need to restore releases from backup:

```bash
# Run the restore tool
npm run restore-from-backup

# Or run directly
node src/restore-from-backup.mjs
```

The restore tool will:

- List all available backups
- Allow you to select which repository to restore
- Restore all releases for that repository from the backup
- Match releases by tag name to ensure correct restoration

### Backup Structure

Each backup file contains:

```json
{
  "repository": "owner/repo",
  "backup_timestamp": "2024-01-01T00:00:00.000Z",
  "total_releases": 5,
  "releases": [
    {
      "id": 123456,
      "tag_name": "v1.0.0",
      "name": "Release v1.0.0",
      "body": "Original release notes...",
      "created_at": "2024-01-01T00:00:00Z",
      "published_at": "2024-01-01T00:00:00Z",
      "html_url": "https://github.com/owner/repo/releases/tag/v1.0.0"
    }
  ]
}
```

## Repository Whitelist Approach

Instead of processing all repositories in your organization, the script uses a whitelist approach for better control and safety:

### Benefits of Whitelist Approach:

- **Selective processing**: Only update repositories you specifically choose
- **Safety**: Prevents accidental updates to repositories you don't want to modify
- **Efficiency**: Faster execution by skipping irrelevant repositories
- **Control**: Easy to add/remove repositories from processing
- **Testing**: Can test on a few repositories before running on all

### Managing the Whitelist:

Edit `repo-whitelist.json` to control which repositories are processed:

```json
{
  "repository_whitelist": ["repo-name-1", "repo-name-2", "repo-name-3"]
}
```

### Adding Repositories:

1. Add repository names (not full URLs) to the whitelist
2. Repository names must match exactly as they appear on GitHub
3. The script will verify each repository exists and is accessible
4. Repositories not in the whitelist will be completely skipped

### Repository Verification:

The script automatically verifies each whitelisted repository:

- ✅ **Accessible**: Repository exists and can be accessed
- ❌ **Not found**: Repository doesn't exist or isn't accessible
- ⚠️ **Error**: Other issues (permissions, etc.)

## Troubleshooting

### "No repositories found"

- Check that the `OWNER` env variable is set correctly
- Verify your GitHub token has the necessary permissions
- Make sure the user/organization exists and is accessible
- Check that `repo-whitelist.json` contains valid repository names
- Ensure the whitelisted repositories exist and are accessible

### "Error updating release"

- Check that your token has write access to the repository
- Verify the repository isn't archived or disabled
- Check GitHub's status page for any API issues

### Rate limiting issues

- The script includes built-in delays, but if you're still hitting limits, increase the delay values
- Consider running during off-peak hours
- Use a token with higher rate limits if available

### Environment variable issues

- **"Missing required environment variables"**: Check your `.env` file exists and contains all required variables
- **".env file not found"**: Ensure the `.env` file is in your project root directory
- **"Error loading environment variables"**: Check file permissions and syntax in your `.env` file
- **Variable not loading**: Verify the variable name matches exactly (case-sensitive)
- **Empty values**: Ensure variables have actual values, not just empty strings

## Important notes

- **Backup**: Consider backing up your release notes before running the script
- **Test first**: Test on a single repository before running on all repositories
- **Review changes**: Check a few updated releases to ensure the changes are correct
- **GitHub API limits**: The script respects rate limits, but large repositories may take time to process

## Support

If you encounter issues:

1. Check the console output for detailed error messages
2. Verify your GitHub token permissions
3. Ensure the target repositories are accessible
4. Check that the username mappings are correct
