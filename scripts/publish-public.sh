#!/usr/bin/env bash
# Publish a sanitized source tree, with only public history as its ancestry.
set -euo pipefail
public_url=${1:?Usage: publish-public.sh PUBLIC_GIT_URL [SOURCE_COMMIT]}
source_commit=$(git rev-parse "${2:-HEAD}^{commit}")
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT

# Authentication is provided by the workflow through Git's environment config.
# Do not fetch private ancestry or make the source commit a public parent.
remote_head=$(git ls-remote "$public_url" refs/heads/main | cut -f1)
parents=()
if [[ -n "$remote_head" ]]; then
  git fetch --no-tags "$public_url" refs/heads/main
  remote_head=$(git rev-parse FETCH_HEAD)
  parents=(-p "$remote_head")
fi

export GIT_INDEX_FILE="$scratch/index"
git read-tree "$source_commit"
git update-index --force-remove .github/workflows/release-public.yml
tree=$(git write-tree)
if [[ -n "$remote_head" && "$tree" == "$(git rev-parse "$remote_head^{tree}")" ]]; then
  echo "Public content is unchanged; no commit or push needed."
  exit 0
fi
git diff-tree --check "${remote_head:-$source_commit}" "$tree"

export GIT_AUTHOR_NAME="$(git show -s --format=%an "$source_commit")"
export GIT_AUTHOR_EMAIL="$(git show -s --format=%ae "$source_commit")"
export GIT_AUTHOR_DATE="$(git show -s --format=%aI "$source_commit")"
export GIT_COMMITTER_NAME="$(git show -s --format=%cn "$source_commit")"
export GIT_COMMITTER_EMAIL="$(git show -s --format=%ce "$source_commit")"
export GIT_COMMITTER_DATE="$(git show -s --format=%cI "$source_commit")"
git show -s --format=format:%B "$source_commit" > "$scratch/message"
printf '\nPublic-Source-Commit: %s\n' "$source_commit" >> "$scratch/message"
release_commit=$(git commit-tree "$tree" "${parents[@]}" < "$scratch/message")

# A normal fast-forward push rejects concurrent edits. Never rewrite main.
git push "$public_url" "$release_commit:refs/heads/main"
echo "Published $release_commit (public parent: ${remote_head:-none})."
