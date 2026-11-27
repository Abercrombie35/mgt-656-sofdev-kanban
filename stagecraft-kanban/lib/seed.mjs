// Based on the local StageCraft proposal, sprint-1 notes and progress log.
export const seed = [
  {id:'foundation',title:'Django foundation & PostgreSQL',detail:'Sprint 1 skeleton shipped; accounts and database wiring.',points:5,stage:'done'},
  {id:'login',title:'Account login & grader accounts',detail:'Existing password sign-in and seed command shipped.',points:3,stage:'done'},
  {id:'ab',title:'A/B test page & live statistics',detail:'Sprint 1 A/B page and counting tests shipped.',points:3,stage:'done'},
  {id:'ci',title:'Automated tests on pull requests',detail:'Sprint 1 CI workflow and unit tests.',points:3,stage:'done'},
  {id:'google',title:'Verify Google sign-in',detail:'Local implementation exists; configure OAuth, test account linking and verify staging.',points:3,stage:'building'},
  {id:'audit',title:'Review existing StageCraft components',detail:'Compare the current team repository against this board and update statuses together.',points:2,stage:'ready'},
  {id:'production',title:'Production workspace & member roles',detail:'Director creates production and invites actors, crew and stage managers with appropriate access.',points:5,stage:'ready'},
  {id:'script',title:'Script, scenes and characters',detail:'Store scripts by scene and line; link characters to scenes and assign cast roles.',points:8,stage:'ready'},
  {id:'actor',title:'Actor dashboard',detail:'Show assigned role, scenes, lines, rehearsal dates and director notes.',points:5,stage:'backlog'},
  {id:'rehearsal',title:'Rehearsal scheduling & attendance',detail:'Schedule scenes, identify required cast, record attendance and track scene readiness.',points:8,stage:'backlog'},
  {id:'inventory',title:'Props, costumes, set & task tracker',detail:'Track production items and open tasks with status and responsibility.',points:5,stage:'backlog'},
  {id:'cue',title:'Cue sheet and printing',detail:'Attach lighting, sound and set-change cues to script lines and print the cue sheet.',points:8,stage:'backlog'},
  {id:'ai',title:'AI-assisted script breakdown',detail:'Draft character, scene, prop, costume, set and cue suggestions for director review.',points:8,stage:'backlog'},
  {id:'qa',title:'Integration, staging & final demo',detail:'Test end-to-end workflows and permissions; confirm staging deployment and prepare final demo.',points:5,stage:'backlog'}
];
