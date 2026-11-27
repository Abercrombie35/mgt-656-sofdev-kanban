// Audited against StageCraft main d8c5392 (November 26, 2026).
// Estimates remain planning estimates rather than measured effort.
export const seed = [
  {id:'foundation',title:'Django foundation & PostgreSQL',detail:'Sprint 1: Django app, database configuration and migrations. PR #1.',points:5,stage:'done'},
  {id:'login',title:'Password login & grader accounts',detail:'Django login/logout and rerunnable grader-account seed; covered by tests. PR #1.',points:3,stage:'done'},
  {id:'ab',title:'A/B test page & live statistics',detail:'Variant assignment, impressions, clicks and stats; team nicknames updated in PR #21.',points:3,stage:'done'},
  {id:'ci',title:'Automated tests on pull requests',detail:'GitHub Actions runs tests against Postgres. Local audit: all 26 Django tests passed. PR #2.',points:3,stage:'done'},
  {id:'deploy',title:'Separate staging & production environments',detail:'Sprint 2 report records both Render apps live with separate Neon databases. Deployment not independently rechecked during audit.',points:3,stage:'done'},
  {id:'prompts',title:'Team coding-agent prompt queue',detail:'Prompt template, queue and status log added in PR #4.',points:2,stage:'done'},
  {id:'production',title:'Create and view productions (US-1, part 1)',detail:'Production creation, creator becomes director, My Productions and membership-restricted details. PR #5; issue #7.',points:5,stage:'done'},
  {id:'permissions',title:'Production membership and script access control',detail:'Director, stage manager, actor and crew roles modeled. Non-members cannot view production; only directors and stage managers may edit scripts. PR #5.',points:3,stage:'done'},
  {id:'script',title:'Paste script and split into scenes (US-2)',detail:'Persist numbered scenes with headings and text; ACT/SCENE splitting and replacement tested. PR #5; issue #8. Line-level persistence is not yet built.',points:8,stage:'done'},
  {id:'demo',title:'Seed sample production',detail:'Rerunnable seed creates a demo production, two scenes, director and actor memberships; verified in tests.',points:2,stage:'done'},
  {id:'ai',title:'AI character breakdown (US-3, part 1)',detail:'OpenRouter extracts characters per scene when configured; rule-based fallback on no key or errors. PR #20; issue #9. HTTP calls mocked in tests.',points:8,stage:'done'},
  {id:'audit',title:'Audit existing StageCraft components',detail:'Checked main d8c5392, user stories, models, views, routes, tests and sprint reports. All 26 local Django tests passed.',points:2,stage:'done'},
  {id:'google',title:'Merge and verify Google sign-in',detail:'An earlier local implementation exists but is not present on audited main. Review, merge and verify separately if the team wants it.',points:3,stage:'ready'},
  {id:'invites',title:'Invite company members with roles (US-1, part 2)',detail:'Invite by email and assign roles. Membership model exists, but invite workflow is not implemented. Issue #7.',points:5,stage:'ready'},
  {id:'casting',title:'Cast actors in roles (US-4)',detail:'Link actors to script characters and their scenes. Issue #11.',points:5,stage:'ready'},
  {id:'ai-expanded',title:'Expand AI breakdown and review/save (US-3, part 2)',detail:'Draft props, costumes, set pieces and lighting/sound cues; allow director to correct and save suggestions. Current implementation only drafts characters. Issue #9.',points:8,stage:'ready'},
  {id:'rehearsal',title:'Schedule rehearsals (US-5)',detail:'Select scenes, schedule sessions and determine which actors must attend; track scene readiness. Issue #12.',points:8,stage:'ready'},
  {id:'attendance',title:'Record rehearsal attendance (US-6)',detail:'Stage manager records attendance and tracks missed rehearsals. Issue #13.',points:3,stage:'backlog'},
  {id:'actor',title:'Actor dashboard (US-7)',detail:'Show assigned role, scenes, lines, rehearsal schedule and notes. Issue #14.',points:5,stage:'backlog'},
  {id:'cue',title:'Script-line cue sheet and printing (US-8)',detail:'Persist line-level references and attach lighting, sound and set changes; print cue sheets. Issue #15.',points:8,stage:'backlog'},
  {id:'inventory',title:'Props, costumes, set & task tracker (US-9)',detail:'Track production items and tasks with status and responsibility. Issue #16.',points:5,stage:'backlog'},
  {id:'qa',title:'Integration testing & final demo',detail:'Verify actual staging/production flows, all role permissions and AI review workflow after remaining stories ship; prepare final demo.',points:5,stage:'backlog'}
];
