import { execSync } from 'child_process';

console.log('Updating Expo and dependencies...');

// Update all dependencies first
console.log('Updating all dependencies...');
execSync('bun update', { stdio: 'inherit' });

// Fix any Expo dependency issues (this also updates Expo packages to compatible versions)
console.log('Fixing Expo dependencies...');
try {
  execSync('bunx expo install --fix', { stdio: 'inherit' });
} catch (error) {
  console.warn('Expo install --fix failed:', error instanceof Error ? error.message : String(error));
}

// Check for outdated packages
console.log('Checking for outdated packages...');
try {
  execSync('bun outdated', { stdio: 'inherit' });
} catch (error) {
  console.log('Could not check outdated packages');
}

console.log('Update complete! You may need to restart your development server.');
console.log('If you encounter issues, try: bun install && bunx expo start --clear');