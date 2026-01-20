// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IProvenanceProvider} from "../interfaces/IProvenanceProvider.sol";

/**
 * @title ProvenanceCore
 * @author ProvenanceKit
 * @notice Abstract base contract for provenance systems
 * @dev Inherit from this contract to build a ProvenanceKit-compatible provenance system.
 *
 *      Features:
 *      - Implements IProvenanceProvider standard
 *      - Provides before/after hooks for extensibility
 *      - Minimal on-chain storage (gas efficient)
 *      - Event-driven architecture
 *
 *      To create a custom provenance system:
 *      1. Inherit from ProvenanceCore
 *      2. Implement required abstract functions
 *      3. Override hooks for custom behavior
 *
 *      Example:
 *      ```solidity
 *      contract MyProvenance is ProvenanceCore {
 *          function _beforeRecordAction(...) internal override {
 *              require(isWhitelisted[msg.sender], "Not allowed");
 *          }
 *      }
 *      ```
 */
abstract contract ProvenanceCore is IProvenanceProvider {
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @dev Mapping from action ID to existence
    mapping(bytes32 => bool) private _actions;

    /// @dev Counter for generating unique action IDs
    uint256 private _actionNonce;

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @notice Thrown when action type is empty
    error EmptyActionType();

    /// @notice Thrown when action already exists
    error ActionAlreadyExists(bytes32 actionId);

    /*//////////////////////////////////////////////////////////////
                           CORE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IProvenanceProvider
     */
    function recordAction(
        string calldata actionType,
        string[] calldata inputs,
        string[] calldata outputs
    ) external virtual returns (bytes32 actionId) {
        // Validate
        if (bytes(actionType).length == 0) revert EmptyActionType();

        // Generate action ID
        actionId = _generateActionId(actionType, inputs, outputs);

        // Check for duplicates
        if (_actions[actionId]) revert ActionAlreadyExists(actionId);

        // Before hook
        _beforeRecordAction(actionId, actionType, inputs, outputs);

        // Record action
        _actions[actionId] = true;

        // Emit standard event
        emit ActionRecorded(
            actionId,
            actionType,
            msg.sender,
            inputs,
            outputs,
            block.timestamp
        );

        // After hook
        _afterRecordAction(actionId, actionType, inputs, outputs);

        return actionId;
    }

    /**
     * @inheritdoc IProvenanceProvider
     */
    function actionExists(bytes32 actionId) external view virtual returns (bool) {
        return _actions[actionId];
    }

    /**
     * @inheritdoc IProvenanceProvider
     */
    function supportsInterface(bytes4 interfaceId) external pure virtual returns (bool) {
        return interfaceId == type(IProvenanceProvider).interfaceId;
    }

    /*//////////////////////////////////////////////////////////////
                              HOOKS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Hook called before an action is recorded
     * @dev Override to add custom validation or preprocessing.
     *      Revert to prevent the action from being recorded.
     *
     * @param actionId The generated action ID
     * @param actionType Type of action
     * @param inputs Input CIDs
     * @param outputs Output CIDs
     */
    function _beforeRecordAction(
        bytes32 actionId,
        string calldata actionType,
        string[] calldata inputs,
        string[] calldata outputs
    ) internal virtual {
        // Default: no-op
        // Override in derived contracts
    }

    /**
     * @notice Hook called after an action is recorded
     * @dev Override to add custom post-processing.
     *      The action has already been recorded at this point.
     *
     * @param actionId The recorded action ID
     * @param actionType Type of action
     * @param inputs Input CIDs
     * @param outputs Output CIDs
     */
    function _afterRecordAction(
        bytes32 actionId,
        string calldata actionType,
        string[] calldata inputs,
        string[] calldata outputs
    ) internal virtual {
        // Default: no-op
        // Override in derived contracts
    }

    /*//////////////////////////////////////////////////////////////
                         INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Generate a unique action ID
     * @dev Override to customize ID generation strategy.
     *      Default uses: chainId + performer + type + inputs + outputs + timestamp + nonce
     *
     *      The chainId is included to ensure action IDs are globally unique across
     *      different blockchain networks, preventing collisions when the same
     *      provenance system is deployed on multiple chains.
     *
     * @param actionType Type of action
     * @param inputs Input CIDs (included in hash for uniqueness)
     * @param outputs Output CIDs (included in hash for uniqueness)
     * @return Unique action ID (globally unique across chains)
     */
    function _generateActionId(
        string calldata actionType,
        string[] calldata inputs,
        string[] calldata outputs
    ) internal virtual returns (bytes32) {
        unchecked {
            _actionNonce++;
        }

        return keccak256(
            abi.encodePacked(
                block.chainid,  // Include chain ID for cross-chain uniqueness
                msg.sender,
                actionType,
                keccak256(abi.encode(inputs)),
                keccak256(abi.encode(outputs)),
                block.timestamp,
                _actionNonce
            )
        );
    }

    /**
     * @notice Check if an action exists (internal version)
     * @param actionId The action ID to check
     * @return True if exists
     */
    function _actionExists(bytes32 actionId) internal view returns (bool) {
        return _actions[actionId];
    }
}
