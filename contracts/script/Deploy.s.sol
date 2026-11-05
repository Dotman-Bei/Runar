// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Runar} from "../src/Runar.sol";

interface VmScript {
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// Deploys Runar. Open the Genesis challenge separately with script/Genesis.s.sol.
///   forge script script/Deploy.s.sol --rpc-url https://rpc.botchain.ai --account runar-deployer \
///     --gas-estimate-multiplier 105 --broadcast
contract Deploy {
    VmScript constant vm = VmScript(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (Runar runar) {
        vm.startBroadcast();
        runar = new Runar();
        vm.stopBroadcast();
    }
}
