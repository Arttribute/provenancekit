// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ProvenanceRegistry} from "../contracts/ProvenanceRegistry.sol";

/**
 * @title Deploy
 * @notice Forge deployment script for ProvenanceRegistry
 *
 * @dev Usage:
 *
 *      # Deploy to Base Sepolia (testnet)
 *      forge script script/Deploy.s.sol \
 *        --rpc-url base-sepolia \
 *        --broadcast \
 *        --verify \
 *        -vvvv
 *
 *      # Deploy to Base Mainnet
 *      forge script script/Deploy.s.sol \
 *        --rpc-url base \
 *        --broadcast \
 *        --verify \
 *        -vvvv
 *
 *      # Deploy to a custom chain (set CUSTOM_RPC_URL env)
 *      forge script script/Deploy.s.sol \
 *        --rpc-url $CUSTOM_RPC_URL \
 *        --broadcast \
 *        -vvvv
 *
 *      Required env vars:
 *        PRIVATE_KEY     — deployer's private key (also becomes hook admin unless HOOK_ADMIN set)
 *        HOOK_ADMIN      — optional: separate hook admin address
 *        BASESCAN_API_KEY — for --verify flag (Base chains only)
 *
 *      Record the deployed address in deployments/<network>.json.
 */
contract Deploy is Script {
    function run() external returns (ProvenanceRegistry registry) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        // Hook admin defaults to deployer; override via HOOK_ADMIN env var
        address hookAdmin = deployer;
        try vm.envAddress("HOOK_ADMIN") returns (address override_) {
            if (override_ != address(0)) hookAdmin = override_;
        } catch {}

        console2.log("=== ProvenanceKit Registry Deployment ===");
        console2.log("Deployer:   ", deployer);
        console2.log("Hook admin: ", hookAdmin);
        console2.log("Chain ID:   ", block.chainid);

        vm.startBroadcast(deployerKey);

        registry = new ProvenanceRegistry(hookAdmin);

        vm.stopBroadcast();

        console2.log("=== Deployed ===");
        console2.log("ProvenanceRegistry:", address(registry));
        console2.log("");
        console2.log("Update deployments/<network>.json with:");
        console2.log('  "contractAddress": "%s"', vm.toString(address(registry)));
        console2.log('  "chainId": %d', block.chainid);
        console2.log('  "deployer": "%s"', deployer);
    }
}
