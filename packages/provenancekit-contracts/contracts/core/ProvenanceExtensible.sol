// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ProvenanceVerifiable} from "./ProvenanceVerifiable.sol";
import {IProvenanceHook} from "../interfaces/IProvenanceHook.sol";

/**
 * @title ProvenanceExtensible
 * @author ProvenanceKit
 * @notice Extends ProvenanceVerifiable with a hook registry for external contract integration
 *
 * @dev This layer adds the "Superfluid-style" extension mechanism: third-party contracts
 *      implement IProvenanceHook and register with this registry to be called when
 *      actions are recorded. Common use cases:
 *
 *      - Payment splitters: auto-distribute revenue based on provenance graph
 *      - Royalty contracts: pay contributors when their work is remixed/used
 *      - Access controllers: gate content access based on who created it
 *      - On-chain analytics: track provenance patterns and usage
 *
 *      Architecture:
 *      ```
 *      ProvenanceExtensible
 *           ↓ extends
 *      ProvenanceVerifiable (proof layer)
 *           ↓ extends
 *      ProvenanceCore (base layer)
 *           ↓ implements
 *      IProvenanceProvider (standard interface)
 *      ```
 *
 *      Hook lifecycle:
 *      1. Third-party deploys contract implementing IProvenanceHook
 *      2. Hook admin calls `registerHook(hookAddress)`
 *      3. When `recordAction()` succeeds, all hooks are called in order
 *      4. Hook failures are silently skipped (provenance recording never reverts)
 *
 *      Example consumer:
 *      ```solidity
 *      contract MyRoyaltySplitter is IProvenanceHook {
 *          function onActionRecorded(
 *              address registry,
 *              bytes32 actionId,
 *              string calldata actionType,
 *              address performer,
 *              string[] calldata inputs,
 *              string[] calldata outputs
 *          ) external returns (bytes4) {
 *              // Queue royalty distribution for each output CID
 *              for (uint i = 0; i < outputs.length; i++) {
 *                  _scheduleDistribution(outputs[i]);
 *              }
 *              return IProvenanceHook.onActionRecorded.selector;
 *          }
 *          function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
 *              return interfaceId == type(IProvenanceHook).interfaceId;
 *          }
 *      }
 *      ```
 */
abstract contract ProvenanceExtensible is ProvenanceVerifiable {
    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Maximum number of hooks to prevent gas exhaustion in _afterRecordAction
    uint256 public constant MAX_HOOKS = 10;

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @dev Ordered list of registered hook contract addresses
    address[] private _hooks;

    /// @dev Fast membership check
    mapping(address => bool) private _hookRegistered;

    /// @dev Address allowed to register and remove hooks
    address private _hookAdmin;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Emitted when a hook is successfully registered
     * @param hook The registered hook address
     */
    event HookRegistered(address indexed hook);

    /**
     * @notice Emitted when a hook is removed
     * @param hook The removed hook address
     */
    event HookRemoved(address indexed hook);

    /**
     * @notice Emitted when a hook call fails (silently skipped)
     * @param hook     Hook that failed
     * @param actionId Action that triggered the hook
     * @param reason   Revert reason (empty if returned wrong selector)
     */
    event HookCallFailed(address indexed hook, bytes32 indexed actionId, bytes reason);

    /**
     * @notice Emitted when hook admin is transferred
     * @param previousAdmin Previous admin address
     * @param newAdmin      New admin address
     */
    event HookAdminTransferred(address indexed previousAdmin, address indexed newAdmin);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @notice Thrown when MAX_HOOKS limit is reached
    error MaxHooksReached();

    /// @notice Thrown when registering an already-registered hook
    error HookAlreadyRegistered(address hook);

    /// @notice Thrown when removing an unregistered hook
    error HookNotRegistered(address hook);

    /// @notice Thrown when caller is not the hook admin
    error NotHookAdmin();

    /// @notice Thrown when the address does not implement IProvenanceHook
    error InvalidHook(address hook);

    /// @notice Thrown when setting hook admin to zero address
    error ZeroAddress();

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Initialize with a hook admin address
     * @param initialHookAdmin Address that can register/remove hooks (typically the deployer)
     */
    constructor(address initialHookAdmin) {
        if (initialHookAdmin == address(0)) revert ZeroAddress();
        _hookAdmin = initialHookAdmin;
        emit HookAdminTransferred(address(0), initialHookAdmin);
    }

    /*//////////////////////////////////////////////////////////////
                           HOOK ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    modifier onlyHookAdmin() {
        if (msg.sender != _hookAdmin) revert NotHookAdmin();
        _;
    }

    /**
     * @notice Register a hook contract
     * @dev Verifies the contract implements IProvenanceHook via ERC-165.
     *      Only the hook admin can call this.
     *
     * @param hook Address of the contract implementing IProvenanceHook
     */
    function registerHook(address hook) external onlyHookAdmin {
        if (_hooks.length >= MAX_HOOKS) revert MaxHooksReached();
        if (_hookRegistered[hook]) revert HookAlreadyRegistered(hook);

        // ERC-165 check: must declare IProvenanceHook support
        try IProvenanceHook(hook).supportsInterface(type(IProvenanceHook).interfaceId) returns (bool ok) {
            if (!ok) revert InvalidHook(hook);
        } catch {
            revert InvalidHook(hook);
        }

        _hooks.push(hook);
        _hookRegistered[hook] = true;

        emit HookRegistered(hook);
    }

    /**
     * @notice Remove a registered hook
     * @dev Uses swap-and-pop for O(n) removal without shifting. Hook order is not preserved.
     *
     * @param hook Address of the hook to remove
     */
    function removeHook(address hook) external onlyHookAdmin {
        if (!_hookRegistered[hook]) revert HookNotRegistered(hook);

        uint256 len = _hooks.length;
        for (uint256 i = 0; i < len; ) {
            if (_hooks[i] == hook) {
                _hooks[i] = _hooks[len - 1];
                _hooks.pop();
                break;
            }
            unchecked { ++i; }
        }

        _hookRegistered[hook] = false;

        emit HookRemoved(hook);
    }

    /**
     * @notice Transfer hook admin role to a new address
     * @param newAdmin New hook admin address (cannot be zero)
     */
    function transferHookAdmin(address newAdmin) external onlyHookAdmin {
        if (newAdmin == address(0)) revert ZeroAddress();
        emit HookAdminTransferred(_hookAdmin, newAdmin);
        _hookAdmin = newAdmin;
    }

    /*//////////////////////////////////////////////////////////////
                              VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get all registered hook addresses
    function getHooks() external view returns (address[] memory) {
        return _hooks;
    }

    /// @notice Get the number of registered hooks
    function hookCount() external view returns (uint256) {
        return _hooks.length;
    }

    /// @notice Check if an address is a registered hook
    function isHookRegistered(address hook) external view returns (bool) {
        return _hookRegistered[hook];
    }

    /// @notice Get the current hook admin address
    function hookAdmin() external view returns (address) {
        return _hookAdmin;
    }

    /*//////////////////////////////////////////////////////////////
                         HOOK DISPATCH (INTERNAL)
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Dispatches to all registered hooks after each action is recorded
     * @dev Overrides ProvenanceCore._afterRecordAction.
     *      Each hook is called in a try/catch — failures emit HookCallFailed
     *      but never revert the provenance record.
     *
     *      Gas note: With MAX_HOOKS = 10, worst-case hook dispatch adds ~150k gas.
     *      Each hook call has a 100k gas stipend to prevent infinite loops.
     */
    function _afterRecordAction(
        bytes32 actionId,
        string calldata actionType,
        string[] calldata inputs,
        string[] calldata outputs
    ) internal virtual override {
        uint256 len = _hooks.length;
        for (uint256 i = 0; i < len; ) {
            address hook = _hooks[i];

            try IProvenanceHook(hook).onActionRecorded(
                address(this),
                actionId,
                actionType,
                msg.sender,
                inputs,
                outputs
            ) returns (bytes4 sel) {
                if (sel != IProvenanceHook.onActionRecorded.selector) {
                    emit HookCallFailed(hook, actionId, abi.encodePacked("wrong selector"));
                }
            } catch (bytes memory reason) {
                emit HookCallFailed(hook, actionId, reason);
            }

            unchecked { ++i; }
        }
    }
}
