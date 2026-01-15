// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ProvenanceRegistry} from "../src/ProvenanceRegistry.sol";

/**
 * @title DeployBase
 * @notice Deployment script for Base mainnet
 * @dev Run with: forge script script/DeployBase.s.sol --rpc-url base --broadcast --verify
 *
 * IMPORTANT: Only run this on mainnet after thorough testing on testnet
 */
contract DeployBase is Script {
    function run() external returns (ProvenanceRegistry) {
        // Get deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Verify we're on Base mainnet (chainId: 8453)
        require(
            block.chainid == 8453,
            "This script is only for Base mainnet"
        );

        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);

        // Deploy ProvenanceRegistry
        ProvenanceRegistry registry = new ProvenanceRegistry();

        console2.log("=== Base Mainnet Deployment ===");
        console2.log("ProvenanceRegistry:", address(registry));
        console2.log("Deployer:", vm.addr(deployerPrivateKey));
        console2.log("Chain ID:", block.chainid);
        console2.log("Block number:", block.number);
        console2.log("===============================");

        vm.stopBroadcast();

        return registry;
    }
}
