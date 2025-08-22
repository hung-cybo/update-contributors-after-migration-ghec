import {config} from 'dotenv';
import {resolve} from 'path';
import {fileURLToPath} from 'url';

/**
 * Load environment variables from a .env file
 * @param {string[]} requiredVars - Array of required environment variable names
 * @param {string} envPath - Path to .env file (defaults to .env in project root)
 * @returns {Object} Object containing loaded environment variables
 */
export function loadEnv(requiredVars = [], envPath = '.env') {
  try {
    // Get the directory of the current module
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = resolve(__filename, '..', '..', '..');

    // Resolve the full path to the .env file
    const fullEnvPath = resolve(__dirname, envPath);

    // Load environment variables using dotenv
    const result = config({path: fullEnvPath});

    if (result.error) {
      throw result.error;
    }

    // Validate required variables
    const missingVars = requiredVars.filter(varName => {
      const value = process.env[varName];
      return !value || value.trim() === '';
    });

    if (missingVars.length > 0) {
      console.error('❌ Missing required environment variables:');
      missingVars.forEach(varName => {
        console.error(`   - ${varName}`);
      });
      console.error(
        `\nPlease check your ${envPath} file and ensure all required variables are set.`,
      );
      process.exit(1);
    }

    console.log('✅ Environment variables loaded successfully');

    // Return the loaded environment variables
    const envVars = {};
    requiredVars.forEach(varName => {
      envVars[varName] = process.env[varName];
    });

    return envVars;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`❌ .env file not found at: ${envPath}`);
      console.error(
        'Please create a .env file with the required environment variables.',
      );
    } else {
      console.error('❌ Error loading environment variables:', error.message);
    }
    process.exit(1);
  }
}

/**
 * Load environment variables with validation and return them as an object
 * @param {string[]} requiredVars - Array of required environment variable names
 * @param {string} envPath - Path to .env file (defaults to .env in project root)
 * @returns {Object} Object containing loaded environment variables
 */
export function loadEnvVars(
  requiredVars = ['GITHUB_TOKEN', 'GITHUB_OWNER'],
  envPath = '.env',
) {
  return loadEnv(requiredVars, envPath);
}

/**
 * Check if a specific environment variable is set
 * @param {string} varName - Name of the environment variable to check
 * @returns {boolean} True if the variable is set and has a non-empty value
 */
export function hasEnvVar(varName) {
  const value = process.env[varName];
  return value && value.trim() !== '';
}
