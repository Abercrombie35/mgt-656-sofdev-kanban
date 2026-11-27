# StageCraft sprint board

Adapted from Hrishi's original LEGO City Sprint HTML; same sticky-note layout,
with the local StageCraft proposal and November 13 progress snapshot as an
initial set of suggested stories. Verify the current team repository before
treating those statuses as authoritative.

## How collaboration works

GitHub OAuth identifies each person without requesting repository access from
their account. The server checks their current write permission against
`Abercrombie35/mgt-656-sofdev-kanban` on every request. The shared board state is
stored as `stories.json` on the separate `board-data` branch, using GitHub's
file revision to prevent silent conflicting updates. No browser local storage
or separate database is needed. The UI refreshes every 15 seconds.

## Deploy on Vercel

1. Copy these project files into the root of the **Kanban** repository (not
   the StageCraft application repository), and push using your existing
   GitHub permissions. Create a branch named `board-data` from the default
   branch. The first card update will create the data file there.
2. Import that repository at https://vercel.com/new with framework preset
   Other. Deploy once to obtain the stable HTTPS production domain.
3. In GitHub Settings > Developer settings > OAuth Apps, create a new OAuth
   app with the production domain as Homepage URL and the callback
   `https://YOUR-APP.vercel.app/api/board?action=callback`. Generate its secret.
4. In GitHub Settings > Developer settings > Personal access tokens >
   Fine-grained tokens, create a repository-specific token for only
   `mgt-656-sofdev-kanban` granting Contents read/write and Metadata read
   (automatic). Set an expiry and rotate it before expiration.
5. Set these variables in Vercel's production Environment Variables:
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `BOARD_GITHUB_TOKEN` (the fine-grained token)
   - `SESSION_SECRET` (at least 32 random characters; e.g. openssl rand -hex 32)
   - `APP_URL` (the stable HTTPS production origin, no query/path)
6. Redeploy. Open the production URL and sign in. Confirm a second accepted
   collaborator can sign in, move a card, and see the same board after refresh.

Do not commit secrets or paste them into chat. These steps require the
repository owner's GitHub and Vercel access.

Run local unit tests with `npm test`. The UI intentionally remains locked
when the authentication and storage backend has not been configured.

## Two-way GitHub issue sync

The source repository is `tkg9/656Final-daunting-horizon`. This is separate
from the existing board's storage-and-auth token. Recommended: configure a
GitHub App with repository **Issues: Read and write**, Metadata read-only,
no other permissions, and no webhook. Allow installation by other accounts;
the source repository owner must install the app for that repository only.
Set the app's App ID and PEM private key in Vercel production as
`SOURCE_GITHUB_APP_ID` and `SOURCE_GITHUB_APP_PRIVATE_KEY`, then redeploy.
Alternatively, the source repository owner can provision a fine-grained
repository-only token with Issues read/write as `SOURCE_GITHUB_TOKEN`.
Never put those credentials in repository files.

Signed-in collaborators with write permission on the source repository can
create new issues through Kanban. The board saves a pending operation before
sending it; a short lease and unique issue marker support retry and deduplication.
The board synchronizes at login, after changes, every minute while open, and
on the Sync GitHub issues button. Closing/reopening reflects in both systems.
For split stories sharing an issue, every linked card must be Done to close it.
New Kanban-generated issues also synchronize title and description; legacy
issues retain the existing acceptance criteria and board-specific notes.
The provider is not called for writes until the source authorization is set.
