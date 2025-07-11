import https from 'https';
import readline from 'readline';

// Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || 'your-token-here';
const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'your-username-here';

// List of repositories to delete
const REPOSITORIES_TO_DELETE = [
  'momentum-listmonk',
  'mbc-landing-page',
  'momentum-business-capital-app',
  'momentum-business-capital-landing',
  'momentum-v02-99',
  'momentum-v02-84',
  'momentum-v01-95',
  'momentum-v01'
];

interface GitHubApiResponse {
  message?: string;
  documentation_url?: string;
}

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function makeGitHubApiRequest(
  method: string,
  path: string,
  data?: any
): Promise<{ statusCode: number; data: GitHubApiResponse }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'GitHub-Repo-Deletion-Script',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const parsedData = body ? JSON.parse(body) : {};
          resolve({ statusCode: res.statusCode!, data: parsedData });
        } catch (error) {
          resolve({ statusCode: res.statusCode!, data: { message: body } });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function checkRepositoryExists(repoName: string): Promise<boolean> {
  try {
    const response = await makeGitHubApiRequest('GET', `/repos/${GITHUB_USERNAME}/${repoName}`);
    return response.statusCode === 200;
  } catch (error) {
    return false;
  }
}

async function deleteRepository(repoName: string): Promise<boolean> {
  try {
    console.log(`🗑️  Deleting repository: ${repoName}`);

    const response = await makeGitHubApiRequest('DELETE', `/repos/${GITHUB_USERNAME}/${repoName}`);

    if (response.statusCode === 204) {
      console.log(`✅ Successfully deleted: ${repoName}`);
      return true;
    } else {
      console.error(`❌ Failed to delete ${repoName}:`, response.data.message);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error deleting ${repoName}:`, error);
    return false;
  }
}

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function confirmDeletion(): Promise<boolean> {
  console.log('\n🔥 DANGER ZONE 🔥');
  console.log('You are about to delete the following repositories:');
  console.log('==========================================');

  for (const repo of REPOSITORIES_TO_DELETE) {
    const exists = await checkRepositoryExists(repo);
    console.log(`- ${repo} ${exists ? '✅ (exists)' : '⚠️  (not found)'}`);
  }

  console.log('==========================================');
  console.log('⚠️  WARNING: This action is IRREVERSIBLE!');
  console.log('⚠️  All code, issues, and data will be permanently lost!');
  console.log('');

  const answer = await askQuestion('Type "DELETE ALL REPOS" to confirm: ');
  return answer === 'DELETE ALL REPOS';
}

async function validateConfiguration(): Promise<boolean> {
  if (GITHUB_TOKEN === 'your-token-here' || !GITHUB_TOKEN) {
    console.error('❌ GitHub token not configured. Please set GITHUB_TOKEN environment variable.');
    return false;
  }

  if (GITHUB_USERNAME === 'your-username-here' || !GITHUB_USERNAME) {
    console.error('❌ GitHub username not configured. Please set GITHUB_USERNAME environment variable.');
    return false;
  }

  // Test API access
  try {
    const response = await makeGitHubApiRequest('GET', '/user');
    if (response.statusCode !== 200) {
      console.error('❌ Invalid GitHub token or insufficient permissions.');
      return false;
    }
    console.log('✅ GitHub API access validated');
    return true;
  } catch (error) {
    console.error('❌ Failed to validate GitHub API access:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 GitHub Repository Deletion Script');
  console.log('====================================');

  // Validate configuration
  if (!(await validateConfiguration())) {
    process.exit(1);
  }

  // Confirm deletion
  if (!(await confirmDeletion())) {
    console.log('❌ Deletion cancelled by user');
    process.exit(0);
  }

  console.log('\n🗑️  Starting repository deletion...');

  let successCount = 0;
  let errorCount = 0;

  for (const repo of REPOSITORIES_TO_DELETE) {
    const success = await deleteRepository(repo);
    if (success) {
      successCount++;
    } else {
      errorCount++;
    }

    // Add a small delay between requests to be respectful to GitHub's API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n📊 Deletion Summary:');
  console.log('==================');
  console.log(`✅ Successfully deleted: ${successCount} repositories`);
  console.log(`❌ Failed to delete: ${errorCount} repositories`);
  console.log(`📦 Total repositories: ${REPOSITORIES_TO_DELETE.length}`);

  rl.close();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n❌ Script interrupted by user');
  rl.close();
  process.exit(0);
});

// Run the script
main().catch((error) => {
  console.error('💥 Script failed:', error);
  rl.close();
  process.exit(1);
});
