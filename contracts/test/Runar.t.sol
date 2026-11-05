// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Runar} from "../src/Runar.sol";

/// Foundry's cheatcodes, declared directly so the tests need no external library.
interface Vm {
    function warp(uint256) external;
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function expectRevert(bytes4) external;
    function assume(bool) external;
}

contract RunarTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    Runar r;

    address constant ANA = address(0xA1);
    address constant BEN = address(0xB2);
    address constant CY = address(0xC3);
    uint256 constant DAY = 86_400;
    uint32 constant D0 = 20_000; // a fixed starting dayId

    Runar.Activity constant RUN = Runar.Activity.Run;
    Runar.Activity constant WALK = Runar.Activity.Walk;
    Runar.Activity constant GYM = Runar.Activity.Gym;
    Runar.Activity constant SWIM = Runar.Activity.Swim;

    function setUp() public {
        r = new Runar();
        atDay(D0, 8);
    }

    // ---------------------------------------------------------------- helpers

    function atDay(uint32 day, uint256 hour) internal { vm.warp(uint256(day) * DAY + hour * 3600); }

    function logAs(address who, Runar.Activity a, uint32 sec, uint32 m) internal returns (uint256) {
        vm.prank(who);
        return r.logWorkout(a, sec, m, "");
    }

    function profile(address who) internal view returns (uint32 total, uint32 streak, uint32 best, uint256 pts, uint32 last) {
        return r.getProfile(who);
    }

    function eq(uint256 a, uint256 b, string memory what) internal pure {
        if (a != b) revert(string.concat(what, ": got ", str(a), ", want ", str(b)));
    }

    function str(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        bytes memory b;
        while (v > 0) { b = abi.encodePacked(bytes1(uint8(48 + v % 10)), b); v /= 10; }
        return string(b);
    }

    // ---------------------------------------------------------------- logging and streaks

    function test_firstWorkoutStartsStreakAndScores() public {
        uint256 id = logAs(ANA, RUN, 1800, 5000);
        eq(id, 1, "workoutId");
        (uint32 total, uint32 streak, uint32 best, uint256 pts, uint32 last) = profile(ANA);
        eq(total, 1, "total");
        eq(streak, 1, "streak");
        eq(best, 1, "best");
        eq(pts, 9, "points: run 3 x 3 blocks x1.0");
        eq(last, D0, "last day");
        Runar.Workout memory w = r.getWorkout(1);
        if (w.user != ANA || w.distanceM != 5000 || w.durationSec != 1800) revert("stored workout");
    }

    function test_nextDayAddsOne_sameDayKeeps_gapResets() public {
        logAs(ANA, RUN, 600, 0);
        atDay(D0 + 1, 7);
        logAs(ANA, RUN, 600, 0);
        (, uint32 streak,,,) = profile(ANA);
        eq(streak, 2, "next day");

        atDay(D0 + 1, 19);
        logAs(ANA, WALK, 600, 0);
        (uint32 total, uint32 s2,,,) = profile(ANA);
        eq(s2, 2, "same day keeps streak");
        eq(total, 3, "same day still counts");

        atDay(D0 + 3, 7);
        logAs(ANA, RUN, 600, 0);
        (, uint32 s3, uint32 best,,) = profile(ANA);
        eq(s3, 1, "gap resets");
        eq(best, 2, "best kept");
    }

    function test_dayBoundaryIsUtcMidnight() public {
        vm.warp(uint256(D0) * DAY + DAY - 1); // 23:59:59
        logAs(ANA, RUN, 600, 0);
        vm.warp(uint256(D0 + 1) * DAY);       // 00:00:00 next day
        logAs(ANA, RUN, 600, 0);
        (, uint32 streak,,,) = profile(ANA);
        eq(streak, 2, "one second later is the next day");
    }

    function test_multiplierCapsAtDay11() public {
        for (uint32 d = 0; d < 12; ++d) { atDay(D0 + d, 7); logAs(ANA, RUN, 600, 0); }
        (, uint32 streak,, uint256 pts,) = profile(ANA);
        eq(streak, 12, "streak");
        // 3 points a day x multipliers 1.0 .. 2.0, 2.0 => floor(3 * tenths / 10)
        uint256 want;
        for (uint32 s = 1; s <= 12; ++s) want += (3 * (s >= 11 ? 20 : 9 + s)) / 10;
        eq(pts, want, "points over 12 days");
    }

    function test_pointsTable() public view {
        eq(r.pointsFor(SWIM, 1, 1), 4, "a started block counts");
        eq(r.pointsFor(RUN, 1800, 1), 9, "run 30 min day 1");
        eq(r.pointsFor(RUN, 1800, 15), 18, "run 30 min capped x2.0");
        eq(r.pointsFor(WALK, 3000, 5), 7, "walk 50 min x1.4 = 7");
        eq(r.pointsFor(GYM, 3601, 2), 15, "gym 7 blocks x1.1 = 15.4 -> 15");
    }

    function test_guards() public {
        vm.prank(ANA); vm.expectRevert(Runar.ZeroDuration.selector);
        r.logWorkout(RUN, 0, 0, "");
        vm.prank(ANA); vm.expectRevert(Runar.DurationTooLong.selector);
        r.logWorkout(RUN, 86_401, 0, "");
        vm.prank(ANA); vm.expectRevert(Runar.GymHasNoDistance.selector);
        r.logWorkout(GYM, 600, 100, "");
        bytes memory long = new bytes(141);
        for (uint256 i; i < 141; ++i) long[i] = "a";
        vm.prank(ANA); vm.expectRevert(Runar.NoteTooLong.selector);
        r.logWorkout(RUN, 600, 0, string(long));
        vm.prank(ANA);
        r.logWorkout(RUN, 600, 0, string(new bytes(140))); // exactly 140 is fine
    }

    // ---------------------------------------------------------------- challenges

    function create(uint32 start, uint32 end, uint8 mask, Runar.Goal goal, uint32 param) internal returns (uint256) {
        return r.createChallenge("Test", start, end, mask, goal, param);
    }

    function test_createValidation() public {
        vm.expectRevert(Runar.BadWindow.selector); create(D0 - 1, D0 + 3, 31, Runar.Goal.Count, 0);
        vm.expectRevert(Runar.BadWindow.selector); create(D0 + 3, D0 + 2, 31, Runar.Goal.Count, 0);
        vm.expectRevert(Runar.BadWindow.selector); create(D0, D0 + 366, 31, Runar.Goal.Count, 0);
        vm.expectRevert(Runar.BadMask.selector); create(D0, D0 + 3, 0, Runar.Goal.Count, 0);
        vm.expectRevert(Runar.BadMask.selector); create(D0, D0 + 3, 32, Runar.Goal.Count, 0);
        vm.expectRevert(Runar.BadGoal.selector); create(D0, D0 + 3, 31, Runar.Goal.Reach, 0);
        vm.expectRevert(Runar.BadGoal.selector); create(D0, D0 + 3, 31, Runar.Goal.Count, 3);
        vm.expectRevert(Runar.BadName.selector); r.createChallenge("", D0, D0, 31, Runar.Goal.Count, 0);
        eq(create(D0, D0, 31, Runar.Goal.Count, 0), 1, "one-day challenge is fine");
    }

    function test_joinTwiceReverts_joinAfterEndReverts() public {
        uint256 id = create(D0, D0 + 2, 31, Runar.Goal.Count, 0);
        vm.prank(ANA); r.joinChallenge(id);
        vm.prank(ANA); vm.expectRevert(Runar.AlreadyJoined.selector); r.joinChallenge(id);
        atDay(D0 + 3, 1);
        vm.prank(BEN); vm.expectRevert(Runar.ChallengeOver.selector); r.joinChallenge(id);
        vm.expectRevert(Runar.NoSuchChallenge.selector); r.joinChallenge(99);
    }

    function test_onlyMatchingWorkoutsInsideWindowCount() public {
        uint256 runs = create(D0 + 1, D0 + 2, 1, Runar.Goal.Distance, 0); // runs only
        vm.prank(ANA); r.joinChallenge(runs);

        logAs(ANA, RUN, 600, 3000);            // before start: profile only
        atDay(D0 + 1, 8);
        logAs(ANA, RUN, 600, 5000);            // counts
        logAs(ANA, WALK, 600, 4000);           // wrong activity
        atDay(D0 + 2, 8);
        logAs(ANA, RUN, 600, 2000);            // counts
        atDay(D0 + 3, 8);
        logAs(ANA, RUN, 600, 9000);            // after end: profile only

        Runar.Standing memory s = r.getStanding(runs, ANA);
        eq(s.count, 2, "count");
        eq(s.distanceM, 7000, "distance");
        eq(s.lastDay, D0 + 2, "last counted day");
        (uint32 total,,,,) = profile(ANA);
        eq(total, 5, "every workout is on the profile");
    }

    function test_closeBeforeEndReverts_thenWinnerAndTieBreak() public {
        uint256 id = create(D0, D0 + 1, 31, Runar.Goal.Count, 0);
        vm.prank(BEN); r.joinChallenge(id); // joinOrder 0
        vm.prank(ANA); r.joinChallenge(id); // joinOrder 1
        vm.prank(CY); r.joinChallenge(id);  // joinOrder 2

        logAs(ANA, RUN, 600, 0);
        logAs(ANA, RUN, 600, 0);
        logAs(BEN, RUN, 600, 0);
        logAs(BEN, GYM, 600, 0);            // BEN ties ANA at 2 and joined first
        logAs(CY, RUN, 600, 0);

        vm.expectRevert(Runar.ChallengeNotOver.selector); r.closeChallenge(id);
        atDay(D0 + 1, 23);
        vm.expectRevert(Runar.ChallengeNotOver.selector); r.closeChallenge(id); // end day itself is still open

        atDay(D0 + 2, 0);
        vm.prank(CY); r.closeChallenge(id); // anyone can close
        Runar.Challenge memory c = r.getChallenge(id);
        if (!c.closed) revert("closed");
        if (c.leader != BEN) revert("tie goes to the earlier joiner");
        eq(c.leaderStat, 2, "winning stat");
        vm.expectRevert(Runar.AlreadyClosed.selector); r.closeChallenge(id);
    }

    function test_laterJoinerOvertakes() public {
        uint256 id = create(D0, D0 + 5, 31, Runar.Goal.Distance, 0);
        vm.prank(ANA); r.joinChallenge(id);
        vm.prank(BEN); r.joinChallenge(id);
        logAs(ANA, RUN, 600, 5000);
        logAs(BEN, RUN, 600, 3000);
        logAs(BEN, RUN, 600, 2001);
        Runar.Challenge memory c = r.getChallenge(id);
        if (c.leader != BEN) revert("leader");
        eq(c.leaderStat, 5001, "leader stat");
        logAs(ANA, SWIM, 600, 1);           // ANA ties at 5001 and joined first
        c = r.getChallenge(id);
        if (c.leader != ANA) revert("tie back to earlier joiner");
    }

    function test_zeroParticipantChallengeClosesWithNoWinner() public {
        uint256 id = create(D0, D0, 31, Runar.Goal.Reach, 3);
        atDay(D0 + 1, 0);
        r.closeChallenge(id);
        Runar.Challenge memory c = r.getChallenge(id);
        if (c.leader != address(0)) revert("no winner");
        if (!c.closed) revert("closed");
    }

    function test_workoutsAfterCloseDoNotCount() public {
        uint256 id = create(D0, D0, 31, Runar.Goal.Count, 0);
        vm.prank(ANA); r.joinChallenge(id);
        logAs(ANA, RUN, 600, 0);
        atDay(D0 + 1, 1);
        r.closeChallenge(id);
        logAs(ANA, RUN, 600, 0);
        eq(r.getStanding(id, ANA).count, 1, "frozen at close");
        eq(r.activeJoins(ANA).length, 0, "ended challenge dropped from the active list");
    }

    function test_activeJoinsAreCapped_andFreeUpWhenChallengesEnd() public {
        vm.startPrank(ANA);
        for (uint256 i; i < 8; ++i) r.joinChallenge(create(D0, D0 + 1, 31, Runar.Goal.Count, 0));
        uint256 ninth = create(D0, D0 + 10, 31, Runar.Goal.Count, 0);
        vm.expectRevert(Runar.TooManyActiveChallenges.selector);
        r.joinChallenge(ninth);
        atDay(D0 + 2, 0);                   // the first eight have ended
        r.joinChallenge(ninth);
        vm.stopPrank();
        eq(r.activeJoins(ANA).length, 1, "only the live one is active");
    }

    function test_participantsPaged() public {
        uint256 id = create(D0, D0 + 1, 31, Runar.Goal.Count, 0);
        vm.prank(ANA); r.joinChallenge(id);
        vm.prank(BEN); r.joinChallenge(id);
        vm.prank(CY); r.joinChallenge(id);
        address[] memory page = r.getParticipants(id, 1, 5);
        eq(page.length, 2, "page length");
        if (page[0] != BEN || page[1] != CY) revert("order");
        eq(r.getParticipants(id, 9, 5).length, 0, "past the end");
        eq(r.getChallenge(id).participantCount, 3, "count");
    }

    // ---------------------------------------------------------------- display names

    function test_displayNames() public {
        vm.prank(ANA); r.setDisplayName("ana.runs");
        vm.prank(BEN); vm.expectRevert(Runar.NameTaken.selector); r.setDisplayName("ana.runs");
        vm.prank(BEN); vm.expectRevert(Runar.BadName.selector); r.setDisplayName("Ana");      // uppercase
        vm.prank(BEN); vm.expectRevert(Runar.BadName.selector); r.setDisplayName("ab");       // too short
        vm.prank(BEN); vm.expectRevert(Runar.BadName.selector); r.setDisplayName("ben runs"); // space
        vm.prank(ANA); r.setDisplayName("ana_2");                                            // rename frees the old one
        vm.prank(BEN); r.setDisplayName("ana.runs");
        if (r.nameOwner(keccak256("ana.runs")) != BEN) revert("reassigned");
        vm.prank(ANA); r.setDisplayName("");
        if (bytes(r.displayName(ANA)).length != 0) revert("cleared");
        if (r.nameOwner(keccak256("ana_2")) != address(0)) revert("released");
    }

    // ---------------------------------------------------------------- fuzz: the stored profile equals a replay

    function testFuzz_profileMatchesReplay(uint8[24] calldata gaps, uint8[24] calldata acts, uint16[24] calldata mins) public {
        uint32 day = D0;
        uint32 streak; uint32 best; uint256 pts; uint32 last; bool any;
        for (uint256 i; i < 24; ++i) {
            day += uint32(gaps[i] % 3);                 // same day, next day or a gap
            atDay(day, 6 + (i % 12));
            Runar.Activity a = Runar.Activity(acts[i] % 5);
            uint32 sec = uint32(mins[i] % 240 + 1) * 60;
            logAs(ANA, a, sec, 0);

            if (!any) streak = 1;
            else if (day == last + 1) streak += 1;
            else if (day != last) streak = 1;
            if (streak > best) best = streak;
            pts += r.pointsFor(a, sec, streak);
            last = day; any = true;
        }
        (uint32 total, uint32 s, uint32 b, uint256 p, uint32 l) = profile(ANA);
        eq(total, 24, "total"); eq(s, streak, "streak"); eq(b, best, "best"); eq(p, pts, "points"); eq(l, last, "last");
    }

    function test_neverAcceptsFunds() public {
        (bool ok,) = address(r).call{value: 0}(abi.encodeWithSignature("nothing()"));
        if (ok) revert("unknown calls revert");
    }
}
