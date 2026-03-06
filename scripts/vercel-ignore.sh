#!/bin/bash
# Vercel "Ignored Build Step" script.
# Exit 0 = skip build. Exit 1 = proceed with build.
#
# Skip deployment when changesets is bumping versions — packages haven't
# been published to npm yet at this point, so pnpm install would fail.
# The real deploy happens on the next push once npm has the new versions.

if [ "$VERCEL_GIT_COMMIT_MESSAGE" = "chore: version packages" ]; then
  echo "Skipping deploy: version-bump commit (packages not published yet)"
  exit 0
fi

exit 1
