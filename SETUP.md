# GitHub Repository Setup Guide

## 1. Create GitHub Repository

1. Go to [GitHub](https://github.com) and create a new repository
2. Name it `sailing-dashboard`
3. Make it public (required for GitHub Pages)
4. Don't initialize with README (we already have one)

## 2. Push Your Code

```bash
# Initialize git repository
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Modern React sailing dashboard"

# Add remote origin (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/sailing-dashboard.git

# Push to GitHub
git push -u origin main
```

## 3. Enable GitHub Pages

1. Go to your repository settings
2. Navigate to "Pages" in the left sidebar
3. Under "Source", select "GitHub Actions"
4. The workflow will automatically deploy when you push changes

## 4. Update Repository URL

Update the repository URL in `package.json`:

```json
{
  "repository": {
    "type": "git",
    "url": "git+https://github.com/YOUR_USERNAME/sailing-dashboard.git"
  }
}
```

## 5. Your Dashboard Will Be Available At:

`https://YOUR_USERNAME.github.io/sailing-dashboard/`

## 6. Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The dashboard will be available at `http://localhost:3000/sailing-dashboard/`
