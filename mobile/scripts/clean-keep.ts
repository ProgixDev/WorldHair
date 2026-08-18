import fs from "fs";
import path from "path";

function deleteKeepFiles(dir: string) {
  try {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Recursively check subdirectories
        deleteKeepFiles(fullPath);
      } else if (item === ".keep") {
        // Delete the .keep file
        fs.unlinkSync(fullPath);
        console.log(`Deleted: ${fullPath}`);
      }
    }
  } catch (error) {
    console.error(`Error processing directory ${dir}:`, error);
  }
}

// Start from the project root
deleteKeepFiles(".");

console.log(
  "Cleanup complete! All .keep files have been removed while preserving parent directories.",
);

// Delete this script file itself
try {
  fs.unlinkSync(__filename);
  console.log("Script file deleted successfully.");
} catch (error) {
  console.error("Failed to delete script file:", error);
}
