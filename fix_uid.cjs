const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Skip Signup.tsx because it creates the user
  if (filePath.endsWith('Signup.tsx')) return;

  let original = content;

  // Replace user.uid with profile.companyId
  content = content.replace(/user\.uid/g, 'profile.companyId');
  
  // Replace const { user } = useAuth(); with const { profile } = useAuth();
  // But some might have both: const { user, profile } = useAuth();
  if (content.includes('const { user } = useAuth();')) {
    content = content.replace('const { user } = useAuth();', 'const { profile } = useAuth();');
  } else if (content.includes('const { user, profile } = useAuth();')) {
    // Already has profile
  } else if (content.includes('const { profile, user } = useAuth();')) {
    // Already has profile
  } else if (content.includes('const { user,') && !content.includes('profile')) {
    content = content.replace('const { user,', 'const { profile,');
  }

  // Replace if (!user) return; with if (!profile?.companyId) return;
  content = content.replace(/if \(!user\) return;/g, 'if (!profile?.companyId) return;');
  
  // Replace [user] dependency with [profile]
  content = content.replace(/\[user\]/g, '[profile]');
  content = content.replace(/\[user,/g, '[profile,');
  content = content.replace(/, user\]/g, ', profile]');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      processFile(fullPath);
    }
  }
}

walkDir(pagesDir);
