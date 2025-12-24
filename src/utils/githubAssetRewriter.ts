// Rewrites local asset paths to GitHub raw CDN URLs
// This allows images to load directly from GitHub instead of local WebContainer

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';

// Image extensions to rewrite
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico', 'bmp', 'svg'];

// Create regex pattern for image extensions
const imageExtPattern = IMAGE_EXTENSIONS.join('|');

/**
 * Rewrite asset paths in file content to use GitHub raw CDN
 */
export function rewriteAssetsToGitHubRaw(
  content: string,
  filePath: string,
  owner: string,
  repo: string,
  branch: string
): string {
  const baseUrl = `${GITHUB_RAW_BASE}/${owner}/${repo}/${branch}`;
  
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  
  // Apply appropriate rewrites based on file type
  if (['html', 'htm'].includes(ext)) {
    return rewriteHtmlAssets(content, baseUrl);
  } else if (['css', 'scss', 'less', 'sass'].includes(ext)) {
    return rewriteCssAssets(content, baseUrl);
  } else if (['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(ext)) {
    return rewriteJsAssets(content, baseUrl);
  }
  
  return content;
}

/**
 * Rewrite image paths in HTML files
 * Handles: src="/path", src="./path", href="/path" for images
 */
function rewriteHtmlAssets(content: string, baseUrl: string): string {
  // Match src="..." or href="..." containing image paths
  // Handles: /assets/img.png, ./images/img.png, assets/img.png
  const attrPattern = new RegExp(
    `((?:src|href)\\s*=\\s*["'])(\\.?\\/?)([^"']*?\\.(${imageExtPattern}))(["'])`,
    'gi'
  );
  
  return content.replace(attrPattern, (match, prefix, slashOrDot, path, _ext, suffix) => {
    // Skip external URLs and data URIs
    if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('//')) {
      return match;
    }
    
    // Build the full path - path already includes the extension
    const fullPath = slashOrDot === './' ? path : (slashOrDot === '/' ? path : `${slashOrDot}${path}`);
    const cleanPath = fullPath.replace(/^\//, ''); // Remove leading slash
    
    return `${prefix}${baseUrl}/${cleanPath}${suffix}`;
  });
}

/**
 * Rewrite image paths in CSS files
 * Handles: url('/path'), url("./path"), url(path)
 */
function rewriteCssAssets(content: string, baseUrl: string): string {
  // Match url(...) containing image paths
  const urlPattern = new RegExp(
    `(url\\s*\\(\\s*["']?)(\\.?\\/?)([^"')]*?\\.(${imageExtPattern}))(["']?\\s*\\))`,
    'gi'
  );
  
  return content.replace(urlPattern, (match, prefix, slashOrDot, path, _ext, suffix) => {
    // Skip external URLs and data URIs
    if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('//')) {
      return match;
    }
    
    // Build the full path - path already includes the extension
    const fullPath = slashOrDot === './' ? path : (slashOrDot === '/' ? path : `${slashOrDot}${path}`);
    const cleanPath = fullPath.replace(/^\//, '');
    
    return `${prefix}${baseUrl}/${cleanPath}${suffix}`;
  });
}

/**
 * Rewrite image paths in JS/TS files
 * Handles: import img from '/path', require('/path'), '/path/img.png' strings
 */
function rewriteJsAssets(content: string, baseUrl: string): string {
  // Match string literals containing image paths
  // This handles: "/assets/img.png", '/images/logo.jpg', `./path/img.png`
  const stringPattern = new RegExp(
    `(["'\`])(\\.?\\/?)([^"'\`]*?\\.(${imageExtPattern}))\\1`,
    'gi'
  );
  
  return content.replace(stringPattern, (match, quote, slashOrDot, path, _ext) => {
    // Skip external URLs and data URIs
    if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('//')) {
      return match;
    }
    
    // Skip node_modules paths
    if (path.includes('node_modules')) {
      return match;
    }
    
    // Build the full path - path already includes the extension
    const fullPath = slashOrDot === './' ? path : (slashOrDot === '/' ? path : `${slashOrDot}${path}`);
    const cleanPath = fullPath.replace(/^\//, '');
    
    return `${quote}${baseUrl}/${cleanPath}${quote}`;
  });
}
