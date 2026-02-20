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

    /// @dev Mapping from resource CID to current owner address.
    ///      address(0) means ownership has never been transferred —
    ///      in that case the effective owner is _resourceCreator[cid].
    mapping(string => address) private _currentOwner;

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

    /// @notice Thrown when caller is not authorized for the operation
    error Unauthorized();

    /// @notice Thrown when referencing a non-existent action
    error ActionNotFound(bytes32 actionId);

    /// @notice Thrown when a resource CID is not registered
    error ResourceNotFound(string cid);

    /*//////////////////////////////////////////////////////////////
                           OWNERSHIP EVENTS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Emitted when an entity asserts it is the rightful owner of a resource.
     * @dev Recording a claim does NOT change the current owner — it creates an
     *      on-chain audit record. Use getOwner() to query the current owner.
     */
    event OwnershipClaimed(
        string indexed cid,
        address indexed claimant,
        uint256 timestamp
    );

    /**
     * @notice Emitted when ownership of a resource moves to a new address.
     * @dev The transfer is recorded permissively — any registered entity can
     *      call transferOwnership(). Trust is conveyed off-chain by the
     *      ext:verification (v1.0.0) extension on the corresponding Action.
     *      On-chain callers that need enforcement should call getOwner() and
     *      verify msg.sender before calling transferOwnership().
     * @param transferActionId Off-chain Action ID linking this event to the
     *        immutable provenance record.
     */
    event OwnershipTransferred(
        string indexed cid,
        address indexed fromOwner,
        address indexed toOwner,
        bytes32 transferActionId,
        uint256 timestamp
    );

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
     * @param contentRef Content reference being attributed (CID recommended)
     * @param role Attribution role: "creator", "contributor", "source"
     */
    function recordAttribution(
        string calldata contentRef,
        string calldata role
    ) external {
        if (bytes(contentRef).length == 0) revert EmptyCID();

        emit AttributionRecorded(
            contentRef,
            msg.sender,
            role,
            block.timestamp
        );
    }

    /**
     * @notice Record attribution for another entity
     * @dev Only the resource creator can record attributions on behalf of others.
     *
     * @param contentRef Content reference being attributed
     * @param entity Entity receiving attribution
     * @param role Attribution role
     */
    function recordAttributionFor(
        string calldata contentRef,
        address entity,
        string calldata role
    ) external {
        if (bytes(contentRef).length == 0) revert EmptyCID();
        if (_resourceCreator[contentRef] != msg.sender) revert Unauthorized();

        emit AttributionRecorded(
            contentRef,
            entity,
            role,
            block.timestamp
        );
    }

    /*//////////////////////////////////////////////////////////////
                    ACTION ATTRIBUTION FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Record attribution for an action
     * @dev Records who was involved in performing an action.
     *      Use this for action-level attribution (W3C PROV Association).
     *
     * @param actionId The action being attributed
     * @param role Attribution role: "creator", "contributor", "source"
     */
    function recordActionAttribution(
        bytes32 actionId,
        string calldata role
    ) external {
        if (!_actionExists(actionId)) revert ActionNotFound(actionId);

        emit ActionAttributionRecorded(
            actionId,
            msg.sender,
            role,
            block.timestamp
        );
    }

    /**
     * @notice Record action attribution for another entity
     * @dev Only callable when the action exists. The caller must be a registered entity.
     *
     * @param actionId The action being attributed
     * @param entity Entity receiving attribution
     * @param role Attribution role
     */
    function recordActionAttributionFor(
        bytes32 actionId,
        address entity,
        string calldata role
    ) external {
        if (!_actionExists(actionId)) revert ActionNotFound(actionId);
        if (!_entities[msg.sender]) revert Unauthorized();

        emit ActionAttributionRecorded(
            actionId,
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
        // Record the action (internal call preserves msg.sender)
        actionId = recordAction(actionType, inputs, outputs);

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
                        OWNERSHIP FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get the current owner of a resource.
     * @dev Returns _resourceCreator if ownership has never been transferred
     *      (i.e. _currentOwner is address(0)), preserving backwards
     *      compatibility with resources registered before this feature.
     *
     * @param cid Content identifier of the resource
     * @return Current owner address
     */
    function getOwner(string calldata cid) external view returns (address) {
        if (!_resources[cid]) revert ResourceNotFound(cid);
        address current = _currentOwner[cid];
        return current == address(0) ? _resourceCreator[cid] : current;
    }

    /**
     * @notice Record an on-chain ownership claim for a resource.
     * @dev Emits OwnershipClaimed. Does NOT change the current owner.
     *      Any registered entity may call this. The claim is a timestamped
     *      audit record; dispute resolution is off-chain.
     *
     * @param cid Content identifier of the resource being claimed
     */
    function recordOwnershipClaim(string calldata cid) external {
        if (!_resources[cid]) revert ResourceNotFound(cid);
        if (!_entities[msg.sender]) revert Unauthorized();

        emit OwnershipClaimed(cid, msg.sender, block.timestamp);
    }

    /**
     * @notice Transfer ownership of a resource to a new address.
     * @dev Permissive: any registered entity may call this. The transfer is
     *      always recorded on-chain. Trust is conveyed by the off-chain
     *      ext:verification (v1.0.0) extension on the corresponding Action.
     *
     *      On-chain callers that need enforcement (e.g. a payment splitter
     *      honouring only voluntary transfers) should check:
     *
     *          require(provenanceRegistry.getOwner(cid) == msg.sender, "Not owner");
     *
     *      before calling this function, or use the `fromOwner` field of the
     *      OwnershipTransferred event to validate post-hoc.
     *
     * @param cid              Content identifier of the resource
     * @param newOwner         Address of the new owner
     * @param transferActionId Off-chain Action ID of the transfer record
     */
    function transferOwnership(
        string calldata cid,
        address newOwner,
        bytes32 transferActionId
    ) external {
        if (!_resources[cid]) revert ResourceNotFound(cid);
        if (!_entities[msg.sender]) revert Unauthorized();
        require(newOwner != address(0), "ProvenanceRegistry: new owner is zero address");

        address current = _currentOwner[cid] == address(0)
            ? _resourceCreator[cid]
            : _currentOwner[cid];

        _currentOwner[cid] = newOwner;

        emit OwnershipTransferred(cid, current, newOwner, transferActionId, block.timestamp);
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
