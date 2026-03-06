// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IProvenanceHook
 * @author ProvenanceKit
 * @notice Standard interface for contracts that react to provenance events
 *
 * @dev Implement this interface to create provenance-aware contracts:
 *      - Payment splitters that distribute revenue when content is used
 *      - Royalty systems that auto-pay contributors on remix/transform
 *      - Access controllers that gate resources based on provenance
 *      - Analytics contracts that track usage patterns on-chain
 *      - Custom governance systems that respond to creation events
 *
 *      Registration:
 *      ```solidity
 *      IProvenanceExtensible(registry).registerHook(address(myHook));
 *      ```
 *
 *      IMPORTANT: Hook failures are silently swallowed — the provenance
 *      record is always created regardless of hook outcomes. Design your
 *      hooks to be robust and handle all failure cases gracefully.
 *
 *      ERC-165 interface ID: 0x... (see IProvenanceHook.interfaceId)
 */
interface IProvenanceHook {
    /*//////////////////////////////////////////////////////////////
                              CALLBACKS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Called after an action is recorded in the provenance registry
     *
     * @dev MUST return `IProvenanceHook.onActionRecorded.selector` (0x8b47ecde)
     *      to signal successful handling. Any other return value or revert is
     *      treated as a failed hook — the registry emits `HookCallFailed` and
     *      continues. This ensures no hook can block provenance recording.
     *
     *      Example — payment splitter hook:
     *      ```solidity
     *      function onActionRecorded(
     *          address registry,
     *          bytes32 actionId,
     *          string calldata actionType,
     *          address performer,
     *          string[] calldata inputs,
     *          string[] calldata outputs
     *      ) external returns (bytes4) {
     *          for (uint i = 0; i < outputs.length; i++) {
     *              _queueSplit(outputs[i]);
     *          }
     *          return IProvenanceHook.onActionRecorded.selector;
     *      }
     *      ```
     *
     * @param registry   Address of the registry calling this hook
     * @param actionId   Unique identifier for the recorded action
     * @param actionType Action type: "create", "transform", "aggregate", "verify", or custom
     * @param performer  Address (msg.sender in registry) that recorded the action
     * @param inputs     Input content references (IPFS CIDs or other schemes)
     * @param outputs    Output content references produced by this action
     * @return selector  Must equal `IProvenanceHook.onActionRecorded.selector`
     */
    function onActionRecorded(
        address registry,
        bytes32 actionId,
        string calldata actionType,
        address performer,
        string[] calldata inputs,
        string[] calldata outputs
    ) external returns (bytes4 selector);

    /*//////////////////////////////////////////////////////////////
                            ERC-165 SUPPORT
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Check if this hook supports a given interface
     * @param interfaceId ERC-165 interface identifier
     * @return True if supported
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}
