// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Runar} from "../src/Runar.sol";

interface VmScript {
    function startBroadcast() external;
    function stopBroadcast() external;
    function envAddress(string calldata) external view returns (address);
}

/// Opens the Genesis challenge (PRD §5.3): 7 days from today, any activity, reach 3 workouts.
///   RUNAR_ADDRESS=0x... forge script script/Genesis.s.sol --rpc-url https://rpc.botchain.ai \
///     --account runar-deployer --broadcast
contract Genesis {
    VmScript constant vm = VmScript(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (uint256 genesisId) {
        Runar runar = Runar(vm.envAddress("RUNAR_ADDRESS"));
        uint32 day = runar.today();
        vm.startBroadcast();
        genesisId = runar.createChallenge("Genesis 7-day", day, day + 6, 31, Runar.Goal.Reach, 3);
        vm.stopBroadcast();
    }
}
