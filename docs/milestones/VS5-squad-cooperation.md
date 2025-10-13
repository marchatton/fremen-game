# VS5: Squad Cooperation

**Duration**: 3-4 weeks  
**Goal**: Role specialization, team objectives, and cooperative mechanics

## Deliverables

### 1. Squad Roles System
- [ ] Four roles: Scout, Thumper Specialist, Rider, Harvester
- [ ] Role selection UI: Before match, choose role with brief description
- [ ] Role limitations:
  - Scout: Can mark spice/AI on minimap, faster movement (+20%), reduced combat
  - Thumper: Can deploy 3 thumpers (others only 1), enhanced vibration radius
  - Rider: Faster mount time (-50%), better worm control, can carry 1 passenger
  - Harvester: Harvest spice 2x faster, carry 2x capacity, slower movement (-10%)
- [ ] Visual distinction: Role-specific armor colors/icons

**Tests**: Roles apply correct modifiers, visual distinction clear

### 2. Scout Mechanics
- [ ] Enhanced minimap: Shows undiscovered spice nodes, AI patrols
- [ ] Mark ability: Place markers visible to team (spice, danger, rally point)
- [ ] Binoculars: Zoom view to 2x, reveal distant entities on minimap
- [ ] Stealth bonus: 50% harder for AI to detect (reduced vision cone)

**Tests**: Scout marks visible to team, minimap shows enhanced info

### 3. Multi-Rider Worm System
- [ ] Rider can mount driver position, 1 passenger on tail segment
- [ ] Passenger controls: Aim weapon, shoot while moving
- [ ] Passenger HUD: Shows speed, heading, worm health
- [ ] Mounting: Rider mounts first, passenger mounts after (5s window)
- [ ] Dismount: Either can initiate, both ejected safely

**Tests**: Passenger can mount/dismount, shoot accurately while riding

### 4. Team Objectives
- [ ] Beacon Activation: 3 beacons across map, team splits to activate simultaneously
  - Each beacon requires 30s channel (interruptible by damage)
  - All 3 must be active within 60s window
  - Reward: 300 spice split among team, temporary sandstorm summon ability
- [ ] Convoy Escort: Protect friendly AI convoy from A to B
  - 3 AI vehicles, must keep 2+ alive for 5 minutes
  - Harkonnen ambushes at 2 locations
  - Reward: 400 spice, rare equipment unlock
- [ ] Spice Rush: Sandstorm reveals mega-node (1000 spice)
  - Visibility reduced, timer 5 minutes
  - Multiple teams may compete (PvP opt-in future)
  - Reward: Split 1000 spice, unique cosmetic

**Tests**: Objectives require coordination, rewards distributed correctly

### 5. Squad Communication
- [ ] Voice proximity chat (WebRTC): Hear teammates within 50m
- [ ] Squad voice channel: Always hear squadmates regardless of distance
- [ ] Quick commands: Radial menu with 8 commands (Follow Me, Hold Position, Attack, etc.)
- [ ] Ping system enhancements: Contextual pings (Enemy Here, Loot Here, Danger)

**Tests**: Voice works with 4 players, quick commands sync, pings contextual

### 6. Resource Sharing
- [ ] Water sharing: Transfer 25 water to nearby teammate (5m, 10s cooldown)
- [ ] Spice pool: Optional squad setting to pool all spice, split evenly on return to Sietch
- [ ] Equipment lending: Can drop equipment for teammate (1 item/minute limit)

**Tests**: Transfers work, pooled resources split correctly

### 7. Squad Formation Bonuses
- [ ] Stay within 30m of 2+ squadmates: +10% XP, +5% movement speed
- [ ] Mixed roles: Bonus applies only if squad has 3+ different roles
- [ ] UI indicator: Shows who's in formation range

**Tests**: Bonuses apply when in range, UI shows formation status

### 8. Cooperative Worm Taming
- [ ] "Tug-of-Worm": Multiple thumpers from different squads attract same worm
- [ ] Worm goes to strongest signal (thumper tier + distance)
- [ ] Thumper Specialist can "boost" signal (1min cooldown, 2x strength for 30s)
- [ ] Adds strategic layer: Do you boost early or save for last second?

**Tests**: Worm responds to strongest signal, boost works correctly

### 9. Clan System (Basic)
- [ ] Create/join clans (max 20 members)
- [ ] Clan shared bank: Deposit spice for clan projects
- [ ] Clan hall in Sietch: Cosmetic upgrades with clan bank
- [ ] Clan leaderboard: Most spice earned this week

**Tests**: Clans persist, shared bank prevents exploits

### 10. Matchmaking Improvements
- [ ] Prefer matching by role: Auto-balance teams to have diverse roles
- [ ] Squad queue: Pre-formed squads (2-4 players) stay together
- [ ] Skill-based matchmaking (basic): Track win rate, match similar skill
- [ ] Region selection: NA East/West, EU, Asia

**Tests**: Matchmaking creates balanced teams, squad queue works

## Success Criteria
- ✅ Squads with diverse roles outperform single-role teams
- ✅ Team objectives require coordination (failure rate >50% for uncoordinated teams)
- ✅ Voice chat functional and clear
- ✅ Players prefer squad queue over solo (>60% use squad queue)
- ✅ Resource sharing used in >40% of matches

## Next Milestone
**VS6: Polish & Scale** - Performance, UI/UX, stability for public playtest
