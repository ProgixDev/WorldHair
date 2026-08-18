import fs from 'fs';
import path from 'path';

const currentDir = process.cwd();
const projectName = path.basename(currentDir);
const normalizedName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '');

console.log(`Updating project name to: ${projectName}`);
console.log(`Normalized name for identifiers: ${normalizedName}`);

// Update package.json
console.log('Updating package.json...');
const packageJsonPath = 'package.json';
let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
packageJson.name = projectName.toLowerCase();
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

// Update app.json
console.log("Updating app.json...");
const appJsonPath = "app.json";
let appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
appJson.expo.name = projectName.toLowerCase();
appJson.expo.slug = projectName.toLowerCase();
appJson.expo.scheme = normalizedName;
// Update bundleIdentifier
if (appJson.expo.ios?.bundleIdentifier) {
  appJson.expo.ios.bundleIdentifier = `com.anonymous.${normalizedName}`;
}
// Update android package
if (appJson.expo.android?.package) {
  appJson.expo.android.package = `com.anonymous.${normalizedName}`;
}
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));

// Update README.md if it contains expo-template
console.log('Checking README.md...');
const readmePath = 'README.md';
if (fs.existsSync(readmePath)) {
  let readme = fs.readFileSync(readmePath, 'utf8');
  if (readme.includes('expo-template')) {
    readme = readme.replace(/expo-template/g, projectName);
    fs.writeFileSync(readmePath, readme);
    console.log('Updated README.md');
  }
}

// Update any other files that might contain expo-template
console.log('Searching for other files containing "expo-template"...');
function updateFiles(dir: string) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && !['node_modules', '.git', '.expo'].includes(item)) {
      updateFiles(fullPath);
    } else if (stat.isFile() && ['.json', '.md', '.ts', '.tsx', '.js', '.jsx'].includes(path.extname(item))) {
      try {
        let content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('expo-template')) {
          content = content.replace(/expo-template/g, projectName);
          fs.writeFileSync(fullPath, content);
          console.log(`Updated: ${fullPath}`);
        }
      } catch (error) {
        // Skip binary files or files that can't be read as UTF-8
      }
    }
  }
}

updateFiles('.');

console.log(`Project name updated to "${projectName}" successfully!`);