// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ProvenanceRegistry} from "../src/ProvenanceRegistry.sol";

/**
 * @title DeployBaseSepolia
 * @notice Deployment script for Base Sepolia testnet
 * @dev Run with: forge script script/DeployBaseSepolia.s.sol --rpc-url base-sepolia --broadcast --verify
 */
contract DeployBaseSepolia is Script {
    function run() external returns (ProvenanceRegistry) {
        // Get deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);

        // Deploy ProvenanceRegistry
        ProvenanceRegistry registry = new ProvenanceRegistry();

        console2.log("ProvenanceRegistry deployed to:", address(registry));
        console2.log("Deployer:", vm.addr(deployerPrivateKey));
        console2.log("Chain ID:", block.chainid);
        console2.log("Block number:", block.number);

        vm.stopBroadcast();

        return registry;
    }
}
