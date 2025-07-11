# GitHub Repository Deletion Script Setup

## ⚠️ CRITICAL WARNING
**This script will permanently delete repositories. This action is IRREVERSIBLE!**

## Prerequisites

1. **Node.js** installed on your system
2. **GitHub Personal Access Token** with appropriate permissions

## Step 1: Create GitHub Personal Access Token

1. Go to GitHub.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a descriptive name (e.g., "Repository Deletion Script")
4. Set expiration as needed
5. **Required permissions:**
   - `repo` (Full control of private repositories)
   - `delete_repo` (Delete repositories)
6. Click "Generate token"
7. **Copy the token immediately** (you won't see it again)

## Step 2: Set Environment Variables

### Option A: Terminal Session (Temporary)
```bash
export GITHUB_TOKEN="your-personal-access-token-here"
export GITHUB_USERNAME="your-github-username"
```

### Option B: Create .env file (Persistent)
```bash
# Create .env file in the same directory as the script
echo "GITHUB_TOKEN=your-personal-access-token-here" > .env
echo "GITHUB_USERNAME=your-github-username" >> .env
```

## Step 3: Install Dependencies

```bash
npm install @types/node typescript ts-node
```

## Step 4: Run the Script

### Using ts-node (Recommended)
```bash
npx ts-node delete-github-repos.ts
```

### Using compiled JavaScript
```bash
npx tsc delete-github-repos.ts
node delete-github-repos.js
```

## What the Script Does

1. **Validates** your GitHub token and username
2. **Checks** which repositories exist
3. **Shows** a confirmation screen with all repositories to be deleted
4. **Requires** you to type "DELETE ALL REPOS" to confirm
5. **Deletes** repositories one by one with progress updates
6. **Provides** a summary of successful and failed deletions

## Repositories to be Deleted

- `momentum-listmonk`
- `mbc-landing-page`
- `momentum-business-capital-app`
- `momentum-business-capital-landing`
- `momentum-v02-99`
- `momentum-v02-84`
- `momentum-v01-95`
- `momentum-v01`

## Safety Features

- ✅ Requires explicit confirmation
- ✅ Checks if repositories exist before attempting deletion
- ✅ Validates GitHub API access before proceeding
- ✅ Provides detailed progress and error reporting
- ✅ Handles interruption gracefully (Ctrl+C)
- ✅ Adds delays between API calls to respect rate limits

## Troubleshooting

### "GitHub token not configured"
- Make sure you set the `GITHUB_TOKEN` environment variable
- Verify the token has the correct permissions

### "Invalid GitHub token or insufficient permissions"
- Check that your token has `repo` and `delete_repo` permissions
- Ensure the token hasn't expired

### "Failed to delete repository"
- Repository might not exist
- Token might not have permission to delete that specific repository
- Repository might be part of an organization (requires different permissions)

## Example Output

```
🚀 GitHub Repository Deletion Script
====================================
✅ GitHub API access validated

🔥 DANGER ZONE 🔥
You are about to delete the following repositories:
==========================================
- momentum-listmonk ✅ (exists)
- mbc-landing-page ✅ (exists)
- momentum-business-capital-app ✅ (exists)
[...]
==========================================
⚠️  WARNING: This action is IRREVERSIBLE!
⚠️  All code, issues, and data will be permanently lost!

Type "DELETE ALL REPOS" to confirm: DELETE ALL REPOS

🗑️  Starting repository deletion...
🗑️  Deleting repository: momentum-listmonk
✅ Successfully deleted: momentum-listmonk
[...]

📊 Deletion Summary:
==================
✅ Successfully deleted: 8 repositories
❌ Failed to delete: 0 repositories
📦 Total repositories: 8
```

## Security Notes

- Never commit your GitHub token to version control
- Use environment variables or secure credential storage
- Consider using a token with minimal required permissions
- Delete the token after use if it's no longer needed
