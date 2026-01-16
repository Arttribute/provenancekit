// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ProvenanceVerifiable} from "./core/ProvenanceVerifiable.sol";
import {IProvenanceProvider} from "./interfaces/IProvenanceProvider.sol";

/**
 * @title ProvenanceRegistry
 * @author ProvenanceKit
 * @notice Reference implementation of a complete provenance registry
 * @dev This is a ready-to-deploy contract that demonstrates the full EAA model:
 *      - Entity registration (who)
 *      - Action recording (what) - inherited from ProvenanceCore
 *      - Resource registration (outputs)
 *      - Attribution recording (relationships)
 *      - Proof verification - inherited from ProvenanceVerifiable
 *
 *      Use this as:
 *      1. A complete solution - deploy and use as-is
 *      2. A reference - see how to build on ProvenanceCore/ProvenanceVerifiable
 *      3. A starting point - inherit and customize
 *
 *      Architecture:
 *      ```
 *      ProvenanceRegistry
 *           ↓ extends
 *      ProvenanceVerifiable (proof layer)
 *           ↓ extends
 *      ProvenanceCore (base layer)
 *           ↓ implements
 *      IProvenanceProvider (standard interface)
 *      ```
 */
contract ProvenanceRegistry is ProvenanceVerifiable {
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @dev Mapping from resource CID to existence
    mapping(string => bool) private _resources;

    /// @dev Mapping from resource CID to root action
    mapping(string => bytes32) private _resourceRootAction;

    /// @dev Mapping from resource CID to creator address
    mapping(string => address) private _resourceCreator;

    /// @dev Mapping from entity address to existence
    mapping(address => bool) private _entities;

    /// @dev Mapping from entity address to entity ID
    mapping(address => string) private _entityIds;

    /// @dev Mapping from entity address to role
    mapping(address => string) private _entityRoles;

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @notice Thrown when CID is empty
    error EmptyCID();

    /// @notice Thrown when resource already exists
    error ResourceAlreadyExists(string cid);

    /// @notice Thrown when entity already exists
    error EntityAlreadyExists(address entity);

    /// @notice Thrown when entity ID is empty
    error EmptyEntityId();

    /*//////////////////////////////////////////////////////////////
                         ENTITY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Register an entity (human, AI, or organization)
     * @dev Maps an on-chain address to an off-chain identity.
     *
     * @param entityId Off-chain identifier (DID, UUID, etc.)
     * @param role Entity role: "human", "ai", "organization"
     */
    function registerEntity(
        string calldata entityId,
        string calldata role
    ) external {
        if (bytes(entityId).length == 0) revert EmptyEntityId();
        if (_entities[msg.sender]) revert EntityAlreadyExists(msg.sender);

        _entities[msg.sender] = true;
        _entityIds[msg.sender] = entityId;
        _entityRoles[msg.sender] = role;

        emit EntityRegistered(
            msg.sender,
            entityId,
            role,
            block.timestamp
        );
    }

    /**
     * @notice Check if an entity is registered
     * @param entity The entity address
     * @return True if registered
     */
    function entityExists(address entity) external view returns (bool) {
        return _entities[entity];
    }

    /**
     * @notice Get the off-chain ID for an entity
     * @param entity The entity address
     * @return The entity ID
     */
    function getEntityId(address entity) external view returns (string memory) {
        return _entityIds[entity];
    }

    /**
     * @notice Get the role for an entity
     * @param entity The entity address
     * @return The entity role
     */
    function getEntityRole(address entity) external view returns (string memory) {
        return _entityRoles[entity];
    }

    /*//////////////////////////////////////////////////////////////
                        RESOURCE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Register a resource (content-addressed output)
     * @dev Links a CID to the action that created it.
     *
     * @param cid Content identifier (IPFS CID)
     * @param resourceType Type: "text", "image", "audio", "video", "code", "data", "model"
     * @param rootAction The action that created this resource
     */
    function registerResource(
        string calldata cid,
        string calldata resourceType,
        bytes32 rootAction
    ) external {
        if (bytes(cid).length == 0) revert EmptyCID();
        if (_resources[cid]) revert ResourceAlreadyExists(cid);

        _resources[cid] = true;
        _resourceRootAction[cid] = rootAction;
        _resourceCreator[cid] = msg.sender;

        emit ResourceRegistered(
            cid,
            resourceType,
            msg.sender,
            rootAction,
            block.timestamp
        );
    }

    /**
     * @notice Check if a resource is registered
     * @param cid The resource CID
     * @return True if registered
     */
    function resourceExists(string calldata cid) external view returns (bool) {
        return _resources[cid];
    }

    /**
     * @notice Get the root action for a resource
     * @param cid The resource CID
     * @return The action that created this resource
     */
    function getResourceRootAction(string calldata cid) external view returns (bytes32) {
        return _resourceRootAction[cid];
    }

    /**
     * @notice Get the creator of a resource
     * @param cid The resource CID
     * @return The creator address
     */
    function getResourceCreator(string calldata cid) external view returns (address) {
        return _resourceCreator[cid];
    }

    /*//////////////////////////////////////////////////////////////
                       ATTRIBUTION FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Record attribution for a resource
     * @dev Records who contributed to creating a resource.
     *
     * @param cid Resource CID being attributed
     * @param role Attribution role: "creator", "contributor", "source"
     */
    function recordAttribution(
        string calldata cid,
        string calldata role
    ) external {
        if (bytes(cid).length == 0) revert EmptyCID();

        emit AttributionRecorded(
            cid,
            msg.sender,
            role,
            block.timestamp
        );
    }

    /**
     * @notice Record attribution for another entity
     * @dev Allows recording attribution for a different address.
     *      The caller must be authorized (in production, add access control).
     *
     * @param cid Resource CID being attributed
     * @param entity Entity receiving attribution
     * @param role Attribution role
     */
    function recordAttributionFor(
        string calldata cid,
        address entity,
        string calldata role
    ) external {
        if (bytes(cid).length == 0) revert EmptyCID();

        emit AttributionRecorded(
            cid,
            entity,
            role,
            block.timestamp
        );
    }

    /*//////////////////////////////////////////////////////////////
                       CONVENIENCE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Record action and register its outputs in one transaction
     * @dev Gas-efficient way to record a complete provenance event.
     *
     * @param actionType Type of action
     * @param inputs Input CIDs
     * @param outputs Output CIDs
     * @param resourceType Type for all output resources
     * @return actionId The recorded action ID
     */
    function recordActionAndRegisterOutputs(
        string calldata actionType,
        string[] calldata inputs,
        string[] calldata outputs,
        string calldata resourceType
    ) external returns (bytes32 actionId) {
        // Record the action
        actionId = this.recordAction(actionType, inputs, outputs);

        // Register each output as a resource
        for (uint256 i = 0; i < outputs.length; i++) {
            if (!_resources[outputs[i]]) {
                _resources[outputs[i]] = true;
                _resourceRootAction[outputs[i]] = actionId;
                _resourceCreator[outputs[i]] = msg.sender;

                emit ResourceRegistered(
                    outputs[i],
                    resourceType,
                    msg.sender,
                    actionId,
                    block.timestamp
                );
            }
        }

        return actionId;
    }

    /*//////////////////////////////////////////////////////////////
                           ERC-165 OVERRIDE
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Check support for interfaces (IProvenanceProvider and ERC-165).
     * @param interfaceId The interface identifier, as specified in ERC-165.
     * @return True if the contract implements interfaceId.
     */
    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IProvenanceProvider).interfaceId
            || interfaceId == 0x01ffc9a7; // ERC-165
    }
}
