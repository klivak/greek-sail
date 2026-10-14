#!/usr/bin/env sh
# Builds the site and publishes dist/ to the gh-pages branch (GitHub Pages serves that branch).
set -e
npm run build
cd dist
touch .nojekyll
git init -q -b gh-pages
git fetch -q https://github.com/klivak/greek-sail.git gh-pages
git reset -q --soft FETCH_HEAD
git add -A
git commit -q -m "deploy: site build" || echo "Nothing changed"
git push -q https://github.com/klivak/greek-sail.git HEAD:gh-pages
rm -rf .git
