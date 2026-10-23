# Feed, Account Settings and Administration

## Feed

`/feed` reads `GET /diaries/feed?filter=all|friends|public&cursor=...`, independently of map radius and map mode. Pages contain at most 20 visible diaries, ordered by creation time and ID. The friends filter includes both public and friend-shared entries by current friends. Private entries never appear in the feed.

Cards separate author identity, story, optional photograph, place/mood context and reactions. Author profiles reuse the existing permission-aware profile sheet. Opening a diary always fetches it again through the authorized diary endpoint. Photographs use a reserved aspect ratio, loading/failure states and a keyboard-dismissible viewer. Reactions update optimistically and roll back after a failed request. Stable diary IDs preserve card identity during filtering and refresh.

The mobile navigation is now a sibling of the navbar, not a descendant of its filtered glass surface. This keeps fixed positioning attached to the viewport rather than the navbar's containing block. Small-screen action labels remain single-line. SSE updates and reaction rollbacks are guarded against a changed login session. Withdrawing public visibility sends a removal event to previously authorized viewers without sending private diary content.

## Settings

`/settings` remains a full page with profile, security, privacy, appearance and danger sections. Profile values are readable rows with explicit progressive editing. The existing theme state and local preference are reused; privacy explanations do not silently change existing diary visibility.

Avatar selection accepts JPEG, PNG and WebP, at most 10 MB and at least 128×128 pixels. The original preview, position adjustment, keyboard arrows and zoom remain available before saving a 512×512 crop. The output uses the actual canvas Blob MIME type, including PNG fallback in browsers without WebP encoding. The server checks the declared MIME type and file signature, limits upload frequency and removes replaced files. Successful updates flow through the existing current-user/local-storage state.

Current-password verification failures return 400, not the session-expiration 401. New passwords require eight characters. Account deletion requires password and explicit confirmation, rejects protected Owner accounts, and transactionally removes diaries, relationships, reactions and notifications. Uploaded media is removed after commit; filesystem errors are logged without rolling back an already committed account deletion.

## Administration

The console separates Overview, Users, Diaries, Roles & Permissions and System Status. Overview uses real counts, recent accounts and recent diaries; missing values stay unknown rather than becoming zero. Today is calculated in Asia/Taipei. Tables retain data while revalidating, support search/filter/pagination and user creation-date sorting, and expose table semantics to assistive technology.

Only Owner can change roles or delete users. Existing Owner accounts cannot be demoted or deleted. Diary deletion requires a reason of 4–300 characters and confirmation. The deletion and `ModerationAction` audit record commit together. System Status reports the current API/database check, not invented uptime metrics. Existing Admin/User/Owner authorization stays on the server.

## Notifications: Root Cause and Replacement

Previously, the bell rendered `friendRequests.slice(0, 3)` and used pending-invitation count as its badge. There was no notification collection, persistence, unread state, reaction event or acceptance event. Styling alone could not repair that missing data flow.

Notifications now store recipient, actor, type, target ID, read timestamp and creation timestamp. Public actor fields are populated when read; diary text, email, passwords, roles and credentials are not copied into notifications.

Supported events:

- Sending an invitation: recipient receives `friend_request`.
- Accepting an invitation: original sender receives `friend_accepted`.
- Reacting to another user's visible diary: its author receives `diary_reaction`.

Friendship changes and their notifications share a MongoDB transaction. Reaction updates and notifications also share a transaction. A unique recipient/actor/type/target index prevents duplicate notifications; undoing or changing a reaction does not revive a read notification. Self-reactions never notify.

Authenticated endpoints:

- `GET /notifications?cursor=...`: bounded page, next cursor and true unread count.
- `PATCH /notifications/:id/read`: mark an owned notification read.
- `PATCH /notifications/read-all`: mark the current recipient's notifications read.
- `GET /notifications/:id/target`: recheck ownership, target existence and diary visibility before navigation.

The bell reuses the existing diary SSE connection with a recipient-scoped `notifications:changed` invalidation. It refreshes on open, reconnect, focus and visible-page 60-second fallback polling. It never creates a second EventSource or WebSocket. Invitation notifications open the incoming-invite tab, acceptance opens the existing profile sheet, and reactions open an authorized diary. Deleted or inaccessible targets show an inline error.

## Deployment

No new dependency or environment variable is required. MongoDB must support transactions, as already required by friendships. New `notifications` and `moderationactions` collections/indexes are additive. The diary feed adds a visibility/creation-time index.

Run from `apps/api` after deploying the source:

```sh
node scripts/backfill-notifications.js
```

This idempotent step creates indexes and adds notifications for existing pending invitations only. It does not remove data, reset read state or fabricate historical reaction/acceptance events. Rebuild the web app and restart the existing API process. No database reset or destructive migration is needed.

## Verification

`notifications-api.test.js` covers real authenticated MongoDB requests, concurrent invite deduplication, recipient isolation, SSE, read persistence, reaction deduplication, pagination, feed visibility, Owner protection, moderation audit, avatar rejection and account cleanup. Supply a loopback `NOTIFICATIONS_TEST_MONGO_URI` whose database begins with `adrift_notifications_test_`.

`apps/web/tests/notifications-browser.mjs` signs in two isolated test accounts against the real local API, exercises invite/acceptance/reaction navigation and unread persistence, validates avatar selection/crop/upload/removal, and checks Feed/Settings/all Admin tabs at the requested nine viewport sizes in both themes. Supply `NOTIFICATIONS_BROWSER_MONGO_URI` with the same loopback database-prefix guard and `PLAYWRIGHT_MODULE`; set `BROWSER=webkit` for WebKit. Map rendering is isolated in this suite and tested separately by `marker-browser.mjs`. Neither suite creates accounts or deletes content on the production database.

## Changed Files

API:

- `apps/api/src/server.js`
- `apps/api/src/models/Diary.js`
- `apps/api/src/models/Notification.js`
- `apps/api/src/models/ModerationAction.js`
- `apps/api/src/routes/admin.js`
- `apps/api/src/routes/diaries.js`
- `apps/api/src/routes/friends.js`
- `apps/api/src/routes/users.js`
- `apps/api/src/routes/notifications.js`
- `apps/api/src/services/friendRelationships.js`
- `apps/api/src/services/notifications.js`
- `apps/api/src/services/deleteAccount.js`
- `apps/api/src/utils/cursor.js`
- `apps/api/src/utils/removeUpload.js`
- `apps/api/scripts/backfill-notifications.js`
- `apps/api/tests/notifications-api.test.js`

Web:

- `apps/web/src/App.jsx`
- `apps/web/src/api/client.js`
- `apps/web/src/components/FeedPage.jsx`
- `apps/web/src/components/AccountSettings.jsx`
- `apps/web/src/components/AdminDashboard.jsx`
- `apps/web/src/components/FriendsPage.jsx`
- `apps/web/src/components/social/FriendProfile.jsx`
- `apps/web/src/components/feed.css`
- `apps/web/src/components/settings.css`
- `apps/web/src/components/admin.css`
- `apps/web/src/components/notifications/NotificationList.jsx`
- `apps/web/src/components/notifications/useNotifications.js`
- `apps/web/src/components/notifications/notifications.css`
- `apps/web/src/styles.css`
- `apps/web/tests/workspace-browser.mjs`
- `apps/web/tests/app-stability-browser.mjs`
- `apps/web/tests/notifications-browser.mjs`

Documentation: `docs/product-surfaces.md`.
