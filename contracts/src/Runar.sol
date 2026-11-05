// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title Runar — workouts logged on-chain, scored in public
/// @notice Every workout is stored and emitted as an event. Streaks, points and challenge standings are kept
/// incrementally, so every read is O(1) and closing a challenge never iterates history.
/// Points are a non-transferable score: there is no token, no transfer function and no value.
/// The contract never holds funds: no function is payable.
contract Runar {
    // ------------------------------------------------------------------ types

    enum Activity { Run, Walk, Gym, Cycle, Swim }
    enum Goal { Distance, Count, Reach }

    struct Workout {
        address user;
        Activity activity;
        uint32 durationSec;
        uint32 distanceM;
        uint64 timestamp;
        string note;
    }

    struct Profile {
        uint32 totalWorkouts;
        uint32 streak;
        uint32 bestStreak;
        uint32 lastWorkoutDay;
        uint256 points;
    }

    struct Challenge {
        string name;
        address creator;
        uint32 startDay;
        uint32 endDay;
        uint8 activityMask;
        Goal goal;
        uint32 goalParam;
        uint32 participantCount;
        bool closed;
        address leader;
        uint64 leaderStat;
        uint32 leaderJoinOrder;
    }

    struct Standing {
        bool joined;
        uint32 joinOrder;
        uint32 count;
        uint64 distanceM;
        uint32 lastDay;
    }

    // ------------------------------------------------------------------ constants

    uint256 public constant NOTE_MAX = 140;
    uint256 public constant NAME_MAX = 40;
    uint32 public constant MAX_DURATION = 86_400;      // one workout cannot exceed a day
    uint32 public constant BUCKET_SEC = 600;           // points are counted per started 10 minutes
    uint32 public constant MAX_WINDOW_DAYS = 366;
    uint256 public constant MAX_ACTIVE_JOINS = 8;      // bounds the per-log challenge update
    uint8 internal constant ALL_ACTIVITIES = 31;

    // ------------------------------------------------------------------ storage

    uint256 public workoutCount;
    uint256 public challengeCount;

    mapping(uint256 => Workout) internal _workouts;
    mapping(address => Profile) internal _profiles;
    mapping(uint256 => Challenge) internal _challenges;
    mapping(uint256 => mapping(address => Standing)) internal _standings;
    mapping(uint256 => address[]) internal _participants;
    mapping(address => uint256[]) internal _activeJoins;

    mapping(address => string) public displayName;
    mapping(bytes32 => address) public nameOwner;

    // ------------------------------------------------------------------ events

    event WorkoutLogged(
        address indexed user,
        uint256 indexed workoutId,
        Activity activityType,
        uint32 durationSec,
        uint32 distanceM,
        uint32 dayId,
        uint64 timestamp,
        uint256 points,
        uint32 streak,
        string note
    );
    event ChallengeCreated(uint256 indexed challengeId, address indexed creator, string name, uint32 startDay, uint32 endDay, uint8 activityMask, Goal goal, uint32 goalParam);
    event ChallengeJoined(uint256 indexed challengeId, address indexed user, uint32 joinOrder);
    event ChallengeProgress(uint256 indexed challengeId, address indexed user, uint256 indexed workoutId, uint32 count, uint64 distanceM);
    event ChallengeClosed(uint256 indexed challengeId, address winner, uint64 stat);
    event DisplayNameSet(address indexed user, string name);

    // ------------------------------------------------------------------ errors

    error ZeroDuration();
    error DurationTooLong();
    error NoteTooLong();
    error GymHasNoDistance();
    error BadName();
    error NameTaken();
    error BadWindow();
    error BadMask();
    error BadGoal();
    error NoSuchChallenge();
    error AlreadyJoined();
    error ChallengeOver();
    error ChallengeNotOver();
    error AlreadyClosed();
    error TooManyActiveChallenges();

    // ------------------------------------------------------------------ logging

    /// @notice Log a workout for msg.sender. Updates the streak, points and every joined challenge it qualifies for.
    function logWorkout(Activity activity, uint32 durationSec, uint32 distanceM, string calldata note)
        external
        returns (uint256 workoutId)
    {
        if (durationSec == 0) revert ZeroDuration();
        if (durationSec > MAX_DURATION) revert DurationTooLong();
        if (bytes(note).length > NOTE_MAX) revert NoteTooLong();
        if (activity == Activity.Gym && distanceM != 0) revert GymHasNoDistance();

        uint32 day = today();
        Profile storage p = _profiles[msg.sender];

        // streak: next day +1, same day unchanged, anything else (or the first ever workout) back to 1
        if (p.totalWorkouts == 0) p.streak = 1;
        else if (day == p.lastWorkoutDay + 1) p.streak += 1;
        else if (day != p.lastWorkoutDay) p.streak = 1;
        if (p.streak > p.bestStreak) p.bestStreak = p.streak;

        uint256 pts = pointsFor(activity, durationSec, p.streak);
        p.points += pts;
        p.totalWorkouts += 1;
        p.lastWorkoutDay = day;

        workoutId = ++workoutCount;
        _workouts[workoutId] = Workout(msg.sender, activity, durationSec, distanceM, uint64(block.timestamp), note);

        emit WorkoutLogged(msg.sender, workoutId, activity, durationSec, distanceM, day, uint64(block.timestamp), pts, p.streak, note);

        _countTowardChallenges(workoutId, activity, distanceM, day);
    }

    /// @dev At most MAX_ACTIVE_JOINS iterations. Challenges that have ended are dropped from the list as it goes.
    function _countTowardChallenges(uint256 workoutId, Activity activity, uint32 distanceM, uint32 day) internal {
        uint256[] storage joins = _activeJoins[msg.sender];
        uint8 bit = uint8(1) << uint8(activity);
        uint256 i = 0;
        while (i < joins.length) {
            uint256 id = joins[i];
            Challenge storage c = _challenges[id];
            if (c.closed || day > c.endDay) {
                joins[i] = joins[joins.length - 1];
                joins.pop();
                continue;
            }
            if (day >= c.startDay && (c.activityMask & bit) != 0) {
                Standing storage s = _standings[id][msg.sender];
                s.count += 1;
                s.distanceM += distanceM;
                s.lastDay = day;
                emit ChallengeProgress(id, msg.sender, workoutId, s.count, s.distanceM);
                _updateLeader(c, s, msg.sender);
            }
            unchecked { ++i; }
        }
    }

    /// @dev Stats only ever grow, so the leader can only change to the athlete whose stat just grew.
    /// Ties go to whoever joined first.
    function _updateLeader(Challenge storage c, Standing storage s, address user) internal {
        uint64 stat = c.goal == Goal.Distance ? s.distanceM : uint64(s.count);
        if (stat == 0) return;
        if (c.leader == address(0) || stat > c.leaderStat || (stat == c.leaderStat && s.joinOrder < c.leaderJoinOrder)) {
            c.leader = user;
            c.leaderStat = stat;
            c.leaderJoinOrder = s.joinOrder;
        } else if (c.leader == user) {
            c.leaderStat = stat;
        }
    }

    // ------------------------------------------------------------------ challenges

    function createChallenge(
        string calldata name,
        uint32 startDay,
        uint32 endDay,
        uint8 activityMask,
        Goal goal,
        uint32 goalParam
    ) external returns (uint256 challengeId) {
        uint256 len = bytes(name).length;
        if (len == 0 || len > NAME_MAX) revert BadName();
        if (startDay < today() || endDay < startDay || endDay - startDay >= MAX_WINDOW_DAYS) revert BadWindow();
        if (activityMask == 0 || activityMask > ALL_ACTIVITIES) revert BadMask();
        if ((goal == Goal.Reach) != (goalParam > 0)) revert BadGoal();

        challengeId = ++challengeCount;
        Challenge storage c = _challenges[challengeId];
        c.name = name;
        c.creator = msg.sender;
        c.startDay = startDay;
        c.endDay = endDay;
        c.activityMask = activityMask;
        c.goal = goal;
        c.goalParam = goalParam;
        emit ChallengeCreated(challengeId, msg.sender, name, startDay, endDay, activityMask, goal, goalParam);
    }

    /// @notice Join before the end day. Only workouts logged after joining, inside the window, count.
    function joinChallenge(uint256 challengeId) external {
        Challenge storage c = _existing(challengeId);
        if (c.closed || today() > c.endDay) revert ChallengeOver();
        Standing storage s = _standings[challengeId][msg.sender];
        if (s.joined) revert AlreadyJoined();

        _pruneEnded(msg.sender);
        if (_activeJoins[msg.sender].length >= MAX_ACTIVE_JOINS) revert TooManyActiveChallenges();

        s.joined = true;
        s.joinOrder = c.participantCount;
        c.participantCount += 1;
        _participants[challengeId].push(msg.sender);
        _activeJoins[msg.sender].push(challengeId);
        emit ChallengeJoined(challengeId, msg.sender, s.joinOrder);
    }

    /// @notice Anyone can close a challenge once its end day has passed. The winner is the stored leader;
    /// address(0) when nobody logged a qualifying workout.
    function closeChallenge(uint256 challengeId) external {
        Challenge storage c = _existing(challengeId);
        if (c.closed) revert AlreadyClosed();
        if (today() <= c.endDay) revert ChallengeNotOver();
        c.closed = true;
        emit ChallengeClosed(challengeId, c.leader, c.leaderStat);
    }

    function _pruneEnded(address user) internal {
        uint256[] storage joins = _activeJoins[user];
        uint32 day = today();
        uint256 i = 0;
        while (i < joins.length) {
            Challenge storage c = _challenges[joins[i]];
            if (c.closed || day > c.endDay) {
                joins[i] = joins[joins.length - 1];
                joins.pop();
            } else {
                unchecked { ++i; }
            }
        }
    }

    function _existing(uint256 challengeId) internal view returns (Challenge storage c) {
        if (challengeId == 0 || challengeId > challengeCount) revert NoSuchChallenge();
        c = _challenges[challengeId];
    }

    // ------------------------------------------------------------------ display names

    /// @notice One public name per address: 3–20 characters of a–z, 0–9, '.' or '_'. Unique; setting a new one
    /// releases the old. An empty string clears it.
    function setDisplayName(string calldata name) external {
        bytes memory b = bytes(name);
        string memory old = displayName[msg.sender];
        if (bytes(old).length != 0) delete nameOwner[keccak256(bytes(old))];
        if (b.length == 0) {
            delete displayName[msg.sender];
            emit DisplayNameSet(msg.sender, "");
            return;
        }
        if (b.length < 3 || b.length > 20) revert BadName();
        for (uint256 i = 0; i < b.length; ++i) {
            bytes1 ch = b[i];
            bool ok = (ch >= 0x61 && ch <= 0x7a) || (ch >= 0x30 && ch <= 0x39) || ch == 0x2e || ch == 0x5f;
            if (!ok) revert BadName();
        }
        bytes32 key = keccak256(b);
        if (nameOwner[key] != address(0)) revert NameTaken();
        nameOwner[key] = msg.sender;
        displayName[msg.sender] = name;
        emit DisplayNameSet(msg.sender, name);
    }

    // ------------------------------------------------------------------ views

    function today() public view returns (uint32) {
        return uint32(block.timestamp / 86_400);
    }

    /// @notice weight × started 10-minute blocks × streak multiplier (×1.0 on day 1, +0.1 a day, capped at ×2.0).
    function pointsFor(Activity activity, uint32 durationSec, uint32 streak) public pure returns (uint256) {
        uint256 weight = activity == Activity.Swim ? 4 : activity == Activity.Run ? 3 : activity == Activity.Walk ? 1 : 2;
        uint256 blocks = (uint256(durationSec) + BUCKET_SEC - 1) / BUCKET_SEC;
        uint256 tenths = streak >= 11 ? 20 : 9 + uint256(streak == 0 ? 1 : streak);
        return (weight * blocks * tenths) / 10;
    }

    function getProfile(address user)
        external
        view
        returns (uint32 totalWorkouts, uint32 currentStreak, uint32 bestStreak, uint256 points, uint32 lastWorkoutDay)
    {
        Profile storage p = _profiles[user];
        return (p.totalWorkouts, p.streak, p.bestStreak, p.points, p.lastWorkoutDay);
    }

    function getWorkout(uint256 workoutId) external view returns (Workout memory) {
        return _workouts[workoutId];
    }

    function getChallenge(uint256 challengeId) external view returns (Challenge memory) {
        return _existing(challengeId);
    }

    function getStanding(uint256 challengeId, address user) external view returns (Standing memory) {
        return _standings[challengeId][user];
    }

    /// @notice Paged list of participants in join order.
    function getParticipants(uint256 challengeId, uint256 offset, uint256 limit) external view returns (address[] memory page) {
        address[] storage all = _participants[challengeId];
        if (offset >= all.length) return new address[](0);
        uint256 end = offset + limit > all.length ? all.length : offset + limit;
        page = new address[](end - offset);
        for (uint256 i = offset; i < end; ++i) page[i - offset] = all[i];
    }

    function activeJoins(address user) external view returns (uint256[] memory) {
        return _activeJoins[user];
    }
}
