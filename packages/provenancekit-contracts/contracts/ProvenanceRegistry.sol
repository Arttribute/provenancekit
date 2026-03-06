// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ProvenanceExtensible} from "./core/ProvenanceExtensible.sol";
import {IProvenanceProvider} from "./interfaces/IProvenanceProvider.sol";
import {IProvenanceHook} from "./interfaces/IProvenanceHook.sol";

/**
 * @title ProvenanceRegistry
 * @author ProvenanceKit
 * @notice Reference implementation of a complete, extensible provenance registry
 *
 * @dev A ready-to-deploy contract implementing the full EAA (Entity-Action-Attribution) model
 *      with cryptographic proofs and a hook system for third-party contract integration.
 *
 *      **For application developers:** Deploy this contract and use it directly.
 *      The SDK's `createViemAdapter` will call `recordAction` automatically.
 *
 *      **For protocol developers:** Inherit from any layer in the stack:
 *      - `IProvenanceProvider`   — just implement the standard interface
 *      - `ProvenanceCore`        — get base action recording + hooks
 *      - `ProvenanceVerifiable`  — add ECDSA proof / commitment support
 *      - `ProvenanceExtensible`  — add hook registry for third-party reactions
 *      - `ProvenanceRegistry`    — full reference implementation
 *
 *      **For hook developers:** Implement `IProvenanceHook` and register via
 *      `registerHook(address)`. Your contract will be called on every `recordAction`.
 *
 *      Architecture (inheritance stack):
 *      ```
 *      ProvenanceRegistry         ← deploy this
 *           ↓ extends
 *      ProvenanceExtensible       ← hook registry + dispatch
 *           ↓ extends
 *      ProvenanceVerifiable       ← ECDSA proof + commitment scheme
 *           ↓ extends
 *      ProvenanceCore             ← base action recording
 *           ↓ implements
 *      IProvenanceProvider        ← EAA standard interface
 *      ```
 *
 *      Hook pattern (third-party integration):
 *      ```
 *      IProvenanceHook            ← implement to react to provenance events
 *           ← PaymentSplitter     ← auto-distribute on resource creation
 *           ← RoyaltySystem       ← pay contributors when work is remixed
 *           ← AccessController   ← gate access based on who created content
 *      ```
 *
 *      Deployment:
 *      ```shell
 *      forge script script/Deploy.s.sol --rpc-url base-sepolia --broadcast
 *      ```
 */
contract ProvenanceRegistry is ProvenanceExtensible {
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @dev Mapping from resource CID to existence flag
    mapping(string => bool) private _resources;

    /// @dev Mapping from resource CID to root action ID
    mapping(string => bytes32) private _resourceRootAction;

    /// @dev Mapping from resource CID to creator address
    mapping(string => address) private _resourceCreator;

    /// @dev Mapping from entity address to existence flag
    mapping(address => bool) private _entities;

    /// @dev Mapping from entity address to off-chain entity ID
    mapping(address => string) private _entityIds;

    /// @dev Mapping from entity address to role string
    mapping(address => string) private _entityRoles;

    /// @dev Mapping from resource CID to current owner.
    ///      Zero address means ownership has never been explicitly transferred;
    ///      in that case the effective owner is _resourceCreator[cid].
    mapping(string => address) private _currentOwner;

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @notice Thrown when a CID argument is empty
    error EmptyCID();

    /// @notice Thrown when trying to register an already-registered resource
    error ResourceAlreadyExists(string cid);

    /// @notice Thrown when trying to register an already-registered entity
    error EntityAlreadyExists(address entity);

    /// @notice Thrown when entity ID is empty
    error EmptyEntityId();

    /// @notice Thrown when caller is not authorised
    error Unauthorized();

    /// @notice Thrown when referencing an action that has not been recorded
    error ActionNotFound(bytes32 actionId);

    /// @notice Thrown when querying a CID that has not been registered
    error ResourceNotFound(string cid);

    /*//////////////////////////////////////////////////////////////
                           OWNERSHIP EVENTS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Emitted when an entity asserts ownership of a resource.
     *
     * @dev Recording a claim does NOT change the current owner — it creates an
     *      on-chain audit trail. Use `getOwner()` to query the effective owner.
     */
    event OwnershipClaimed(
        string indexed cid,
        address indexed claimant,
        uint256 timestamp
    );

    /**
     * @notice Emitted when ownership moves to a new address.
     *
     * @dev Transfers are recorded permissively — any registered entity may call
     *      `transferOwnership()`. Callers that need enforcement should verify
     *      `getOwner(cid) == msg.sender` before calling, or check the
     *      `fromOwner` field post-hoc.
     *
     * @param transferActionId Off-chain Action ID linking this event to the
     *        provenance record of the transfer action.
     */
    event OwnershipTransferred(
        string indexed cid,
        address indexed fromOwner,
        address indexed toOwner,
        bytes32 transferActionId,
        uint256 timestamp
    );

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Deploy the ProvenanceRegistry
     * @param hookAdmin Address that can register/remove hooks (typically the deployer)
     *
     * @dev The hook admin can be transferred later via `transferHookAdmin(newAdmin)`.
     *      For self-managed deployments, pass `msg.sender` as hookAdmin.
     */
    constructor(address hookAdmin) ProvenanceExtensible(hookAdmin) {}

    /*//////////////////////////////////////////////////////////////
                         ENTITY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Register an entity (human, AI, or organisation)
     * @dev Maps an on-chain address to an off-chain EAA identity.
     *      One address can only register once.
     *
     * @param entityId  Off-chain identifier (DID, UUID, wallet address, etc.)
     * @param role      Entity role: "human", "ai", "organization", or custom ext:namespace
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

        emit EntityRegistered(msg.sender, entityId, role, block.timestamp);
    }

    /// @notice Check if an entity is registered
    function entityExists(address entity) external view returns (bool) {
        return _entities[entity];
    }

    /// @notice Get the off-chain ID for a registered entity
    function getEntityId(address entity) external view returns (string memory) {
        return _entityIds[entity];
    }

    /// @notice Get the role for a registered entity
    function getEntityRole(address entity) external view returns (string memory) {
        return _entityRoles[entity];
    }

    /*//////////////////////////////////////////////////////////////
                        RESOURCE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Register a resource (content-addressed output)
     * @dev Links a content reference (CID) to the action that created it.
     *      Use `recordActionAndRegisterOutputs` for gas efficiency.
     *
     * @param cid          Content identifier (IPFS CID v0/v1 recommended)
     * @param resourceType Type: "text", "image", "audio", "video", "code", "dataset", "model", "other"
     * @param rootAction   The action that produced this resource
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

        emit ResourceRegistered(cid, resourceType, msg.sender, rootAction, block.timestamp);
    }

    /// @notice Check if a resource is registered
    function resourceExists(string calldata cid) external view returns (bool) {
        return _resources[cid];
    }

    /// @notice Get the root action that created a resource
    function getResourceRootAction(string calldata cid) external view returns (bytes32) {
        return _resourceRootAction[cid];
    }

    /// @notice Get the creator address of a resource
    function getResourceCreator(string calldata cid) external view returns (address) {
        return _resourceCreator[cid];
    }

    /*//////////////////////////////////////////////////////////////
                       ATTRIBUTION FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Record attribution for a resource (self-attribution)
     * @dev Anyone can record their own attribution for any content reference.
     *      Use `recordAttributionFor` to attribute another entity (requires resource creator).
     *
     * @param contentRef Content reference being attributed (CID recommended)
     * @param role       Attribution role: "creator", "contributor", "source", or custom ext:namespace
     */
    function recordAttribution(
        string calldata contentRef,
        string calldata role
    ) external {
        if (bytes(contentRef).length == 0) revert EmptyCID();

        emit AttributionRecorded(contentRef, msg.sender, role, block.timestamp);
    }

    /**
     * @notice Record attribution for another entity on behalf of the resource creator
     * @dev Only the resource creator can call this.
     *
     * @param contentRef Content reference being attributed
     * @param entity     Entity address receiving attribution
     * @param role       Attribution role
     */
    function recordAttributionFor(
        string calldata contentRef,
        address entity,
        string calldata role
    ) external {
        if (bytes(contentRef).length == 0) revert EmptyCID();
        if (_resourceCreator[contentRef] != msg.sender) revert Unauthorized();

        emit AttributionRecorded(contentRef, entity, role, block.timestamp);
    }

    /*//////////////////////////////////////////////////////////////
                    ACTION ATTRIBUTION FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Record attribution for an action (self-attribution)
     * @dev Use for action-level attribution — "who was involved in this activity".
     *      Maps to W3C PROV Association.
     *
     * @param actionId The action being attributed (must exist)
     * @param role     Attribution role: "creator", "contributor", "source", or custom ext:namespace
     */
    function recordActionAttribution(
        bytes32 actionId,
        string calldata role
    ) external {
        if (!_actionExists(actionId)) revert ActionNotFound(actionId);

        emit ActionAttributionRecorded(actionId, msg.sender, role, block.timestamp);
    }

    /**
     * @notice Record action attribution for another entity
     * @dev Caller must be a registered entity.
     *
     * @param actionId The action being attributed
     * @param entity   Entity receiving attribution
     * @param role     Attribution role
     */
    function recordActionAttributionFor(
        bytes32 actionId,
        address entity,
        string calldata role
    ) external {
        if (!_actionExists(actionId)) revert ActionNotFound(actionId);
        if (!_entities[msg.sender]) revert Unauthorized();

        emit ActionAttributionRecorded(actionId, entity, role, block.timestamp);
    }

    /*//////////////////////////////////////////////////////////////
                       CONVENIENCE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Record an action and register all its outputs in one transaction
     * @dev Preferred over separate `recordAction` + `registerResource` calls.
     *      Saves one transaction and ensures atomic action+resource creation.
     *      Hooks are called once (for the action), not per output.
     *
     * @param actionType   Type of action
     * @param inputs       Input content references
     * @param outputs      Output content references (all registered as resources)
     * @param resourceType Resource type applied to all outputs
     * @return actionId    The recorded action ID
     */
    function recordActionAndRegisterOutputs(
        string calldata actionType,
        string[] calldata inputs,
        string[] calldata outputs,
        string calldata resourceType
    ) external returns (bytes32 actionId) {
        actionId = recordAction(actionType, inputs, outputs);

        uint256 len = outputs.length;
        for (uint256 i = 0; i < len; ) {
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
            unchecked { ++i; }
        }
    }

    /*//////////////////////////////////////////////////////////////
                        OWNERSHIP FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get the current owner of a resource
     * @dev Returns creator if ownership was never explicitly transferred.
     *
     * @param cid Content identifier of the resource
     * @return    Current owner address
     */
    function getOwner(string calldata cid) external view returns (address) {
        if (!_resources[cid]) revert ResourceNotFound(cid);
        address current = _currentOwner[cid];
        return current == address(0) ? _resourceCreator[cid] : current;
    }

    /**
     * @notice Record an on-chain ownership claim for a resource
     * @dev Emits OwnershipClaimed but does NOT change the current owner.
     *      Creates a timestamped audit record; dispute resolution is off-chain.
     *      Caller must be a registered entity.
     *
     * @param cid Content identifier of the resource being claimed
     */
    function recordOwnershipClaim(string calldata cid) external {
        if (!_resources[cid]) revert ResourceNotFound(cid);
        if (!_entities[msg.sender]) revert Unauthorized();

        emit OwnershipClaimed(cid, msg.sender, block.timestamp);
    }

    /**
     * @notice Transfer ownership of a resource
     * @dev Permissive: any registered entity may call this. On-chain callers
     *      that need enforcement should verify `getOwner(cid) == msg.sender`
     *      before calling, or use the `fromOwner` field in OwnershipTransferred.
     *
     * @param cid              Content identifier of the resource
     * @param newOwner         New owner address
     * @param transferActionId Off-chain Action ID of the transfer provenance record
     */
    function transferOwnership(
        string calldata cid,
        address newOwner,
        bytes32 transferActionId
    ) external {
        if (!_resources[cid]) revert ResourceNotFound(cid);
        if (!_entities[msg.sender]) revert Unauthorized();
        require(newOwner != address(0), "ProvenanceRegistry: zero address");

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
     * @notice Check supported interfaces
     * @dev Supports IProvenanceProvider (EAA standard), IProvenanceHook consumer,
     *      and ERC-165 itself.
     *
     * @param interfaceId ERC-165 interface identifier
     * @return True if the interface is supported
     */
    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IProvenanceProvider).interfaceId
            || interfaceId == type(IProvenanceHook).interfaceId
            || interfaceId == 0x01ffc9a7; // ERC-165
    }
}
