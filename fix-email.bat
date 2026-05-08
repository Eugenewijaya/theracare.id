@echo off
set FILTER_BRANCH_SQUELCH_WARNING=1
git filter-branch -f --env-filter "if [ \"$GIT_COMMITTER_EMAIL\" = \"dev@example.com\" ]; then export GIT_COMMITTER_NAME=\"Eugene Wijaya\"; export GIT_COMMITTER_EMAIL=\"evidwijaya@gmail.com\"; fi; if [ \"$GIT_AUTHOR_EMAIL\" = \"dev@example.com\" ]; then export GIT_AUTHOR_NAME=\"Eugene Wijaya\"; export GIT_AUTHOR_EMAIL=\"evidwijaya@gmail.com\"; fi" -- --branches
