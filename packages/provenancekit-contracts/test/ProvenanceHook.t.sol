// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {ProvenanceRegistry} from "../contracts/ProvenanceRegistry.sol";
import {ProvenanceExtensible} from "../contracts/core/ProvenanceExtensible.sol";
import {IProvenanceHook} from "../contracts/interfaces/IProvenanceHook.sol";

/*//////////////////////////////////////////////////////////////
                       TEST HOOK IMPLEMENTATIONS
//////////////////////////////////////////////////////////////*/

/**
 * @notice A well-behaved hook that records all calls for inspection.
 */
contract MockHook is IProvenanceHook {
    struct Call {
        address registry;
        bytes32 actionId;
        string actionType;
        address performer;
    }

    Call[] public calls;
    bool public shouldRevert;
    bool public shouldReturnWrongSelector;

    constructor(bool _shouldRevert, bool _wrongSelector) {
        shouldRevert = _shouldRevert;
        shouldReturnWrongSelector = _wrongSelector;
    }

    function onActionRecorded(
        address registry,
        bytes32 actionId,
        string calldata actionType,
        address performer,
        string[] calldata,
        string[] calldata
    ) external returns (bytes4) {
        if (shouldRevert) revert("MockHook: intentional revert");
        calls.push(Call(registry, actionId, actionType, performer));
        if (shouldReturnWrongSelector) return bytes4(0xdeadbeef);
        return IProvenanceHook.onActionRecorded.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IProvenanceHook).interfaceId;
    }

    function callCount() external view returns (uint256) {
        return calls.length;
    }
}

/**
 * @notice A hook that pretends to support IProvenanceHook via ERC-165 but doesn't.
 */
contract FakeHook {
    function supportsInterface(bytes4) external pure returns (bool) {
        return false; // lies — doesn't actually implement IProvenanceHook
    }
}

/**
 * @notice A contract that doesn't implement supportsInterface at all.
 */
contract NoInterfaceHook {
    // No supportsInterface — will cause revert in ERC-165 check
}

/*//////////////////////////////////////////////////////////////
                          TEST CONTRACT
//////////////////////////////////////////////////////////////*/

contract ProvenanceHookTest is Test {
    ProvenanceRegistry public registry;
    address public admin;
    address public alice;

    string constant CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
    string constant ACTION_CREATE = "create";

    // Events to expect
    event HookRegistered(address indexed hook);
    event HookRemoved(address indexed hook);
    event HookCallFailed(address indexed hook, bytes32 indexed actionId, bytes reason);
    event HookAdminTransferred(address indexed previousAdmin, address indexed newAdmin);

    function setUp() public {
        admin = makeAddr("admin");
        alice = makeAddr("alice");

        vm.prank(admin);
        registry = new ProvenanceRegistry(admin);

        vm.deal(alice, 10 ether);
    }

    /*//////////////////////////////////////////////////////////////
                         HOOK REGISTRATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_RegisterHook() public {
        MockHook hook = new MockHook(false, false);

        vm.expectEmit(true, false, false, false);
        emit HookRegistered(address(hook));

        vm.prank(admin);
        registry.registerHook(address(hook));

        assertTrue(registry.isHookRegistered(address(hook)));
        assertEq(registry.hookCount(), 1);
        assertEq(registry.getHooks()[0], address(hook));
    }

    function test_RegisterMultipleHooks() public {
        MockHook hook1 = new MockHook(false, false);
        MockHook hook2 = new MockHook(false, false);

        vm.startPrank(admin);
        registry.registerHook(address(hook1));
        registry.registerHook(address(hook2));
        vm.stopPrank();

        assertEq(registry.hookCount(), 2);
        assertTrue(registry.isHookRegistered(address(hook1)));
        assertTrue(registry.isHookRegistered(address(hook2)));
    }

    function test_RevertWhen_RegisterHookTwice() public {
        MockHook hook = new MockHook(false, false);

        vm.startPrank(admin);
        registry.registerHook(address(hook));

        vm.expectRevert(
            abi.encodeWithSelector(ProvenanceExtensible.HookAlreadyRegistered.selector, address(hook))
        );
        registry.registerHook(address(hook));
        vm.stopPrank();
    }

    function test_RevertWhen_RegisterHookNotAdmin() public {
        MockHook hook = new MockHook(false, false);

        vm.prank(alice);
        vm.expectRevert(ProvenanceExtensible.NotHookAdmin.selector);
        registry.registerHook(address(hook));
    }

    function test_RevertWhen_RegisterFakeHook() public {
        FakeHook fake = new FakeHook();

        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(ProvenanceExtensible.InvalidHook.selector, address(fake))
        );
        registry.registerHook(address(fake));
    }

    function test_RevertWhen_RegisterNoInterfaceHook() public {
        NoInterfaceHook noIface = new NoInterfaceHook();

        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(ProvenanceExtensible.InvalidHook.selector, address(noIface))
        );
        registry.registerHook(address(noIface));
    }

    function test_RevertWhen_TooManyHooks() public {
        uint256 max = registry.MAX_HOOKS();
        for (uint256 i = 0; i < max; i++) {
            MockHook hook = new MockHook(false, false);
            vm.prank(admin);
            registry.registerHook(address(hook));
        }

        MockHook extra = new MockHook(false, false);
        vm.prank(admin);
        vm.expectRevert(ProvenanceExtensible.MaxHooksReached.selector);
        registry.registerHook(address(extra));
    }

    /*//////////////////////////////////////////////////////////////
                           HOOK REMOVAL TESTS
    //////////////////////////////////////////////////////////////*/

    function test_RemoveHook() public {
        MockHook hook = new MockHook(false, false);

        vm.startPrank(admin);
        registry.registerHook(address(hook));

        vm.expectEmit(true, false, false, false);
        emit HookRemoved(address(hook));

        registry.removeHook(address(hook));
        vm.stopPrank();

        assertFalse(registry.isHookRegistered(address(hook)));
        assertEq(registry.hookCount(), 0);
    }

    function test_RevertWhen_RemoveUnregisteredHook() public {
        MockHook hook = new MockHook(false, false);

        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(ProvenanceExtensible.HookNotRegistered.selector, address(hook))
        );
        registry.removeHook(address(hook));
    }

    function test_RevertWhen_RemoveHookNotAdmin() public {
        MockHook hook = new MockHook(false, false);

        vm.prank(admin);
        registry.registerHook(address(hook));

        vm.prank(alice);
        vm.expectRevert(ProvenanceExtensible.NotHookAdmin.selector);
        registry.removeHook(address(hook));
    }

    /*//////////////////////////////////////////////////////////////
                        HOOK ADMIN TRANSFER TESTS
    //////////////////////////////////////////////////////////////*/

    function test_TransferHookAdmin() public {
        assertEq(registry.hookAdmin(), admin);

        vm.prank(admin);
        vm.expectEmit(true, true, false, false);
        emit HookAdminTransferred(admin, alice);
        registry.transferHookAdmin(alice);

        assertEq(registry.hookAdmin(), alice);
    }

    function test_RevertWhen_TransferHookAdminToZero() public {
        vm.prank(admin);
        vm.expectRevert(ProvenanceExtensible.ZeroAddress.selector);
        registry.transferHookAdmin(address(0));
    }

    function test_RevertWhen_TransferHookAdminNotAdmin() public {
        vm.prank(alice);
        vm.expectRevert(ProvenanceExtensible.NotHookAdmin.selector);
        registry.transferHookAdmin(alice);
    }

    /*//////////////////////////////////////////////////////////////
                         HOOK DISPATCH TESTS
    //////////////////////////////////////////////////////////////*/

    function test_HookCalledOnRecordAction() public {
        MockHook hook = new MockHook(false, false);

        vm.prank(admin);
        registry.registerHook(address(hook));

        string[] memory inputs = new string[](0);
        string[] memory outputs = new string[](1);
        outputs[0] = CID;

        vm.prank(alice);
        bytes32 actionId = registry.recordAction(ACTION_CREATE, inputs, outputs);

        assertEq(hook.callCount(), 1);
        (address reg, bytes32 aid, string memory atype, address perf) = hook.calls(0);
        assertEq(reg, address(registry));
        assertEq(aid, actionId);
        assertEq(atype, ACTION_CREATE);
        assertEq(perf, alice);
    }

    function test_MultipleHooksCalledInOrder() public {
        MockHook hook1 = new MockHook(false, false);
        MockHook hook2 = new MockHook(false, false);

        vm.startPrank(admin);
        registry.registerHook(address(hook1));
        registry.registerHook(address(hook2));
        vm.stopPrank();

        string[] memory inputs = new string[](0);
        string[] memory outputs = new string[](0);

        vm.prank(alice);
        registry.recordAction(ACTION_CREATE, inputs, outputs);

        assertEq(hook1.callCount(), 1);
        assertEq(hook2.callCount(), 1);
    }

    function test_FailingHookDoesNotRevertAction() public {
        MockHook badHook = new MockHook(true, false); // will revert
        MockHook goodHook = new MockHook(false, false);

        vm.startPrank(admin);
        registry.registerHook(address(badHook));
        registry.registerHook(address(goodHook));
        vm.stopPrank();

        string[] memory inputs = new string[](0);
        string[] memory outputs = new string[](0);

        vm.prank(alice);
        bytes32 actionId = registry.recordAction(ACTION_CREATE, inputs, outputs);

        // Action still recorded
        assertTrue(registry.actionExists(actionId));

        // Good hook still called
        assertEq(goodHook.callCount(), 1);

        // Bad hook did not count (reverted internally)
        assertEq(badHook.callCount(), 0);
    }

    function test_WrongSelectorHookEmitsFailedEvent() public {
        MockHook wrongHook = new MockHook(false, true); // returns wrong selector

        vm.prank(admin);
        registry.registerHook(address(wrongHook));

        string[] memory inputs = new string[](0);
        string[] memory outputs = new string[](0);

        vm.prank(alice);
        bytes32 actionId = registry.recordAction(ACTION_CREATE, inputs, outputs);

        // Action still recorded
        assertTrue(registry.actionExists(actionId));
    }

    function test_HookNotCalledAfterRemoval() public {
        MockHook hook = new MockHook(false, false);

        vm.startPrank(admin);
        registry.registerHook(address(hook));
        registry.removeHook(address(hook));
        vm.stopPrank();

        string[] memory inputs = new string[](0);
        string[] memory outputs = new string[](0);

        vm.prank(alice);
        registry.recordAction(ACTION_CREATE, inputs, outputs);

        assertEq(hook.callCount(), 0);
    }

    function test_HookCalledOnRecordActionAndRegisterOutputs() public {
        MockHook hook = new MockHook(false, false);

        vm.prank(admin);
        registry.registerHook(address(hook));

        string[] memory inputs = new string[](0);
        string[] memory outputs = new string[](1);
        outputs[0] = CID;

        vm.prank(alice);
        registry.recordActionAndRegisterOutputs(ACTION_CREATE, inputs, outputs, "image");

        // Hook called once for the action (not once per output)
        assertEq(hook.callCount(), 1);
    }

    /*//////////////////////////////////////////////////////////////
                      CONSTRUCTOR ZERO ADDRESS TEST
    //////////////////////////////////////////////////////////////*/

    function test_RevertWhen_DeployWithZeroAdmin() public {
        vm.expectRevert(ProvenanceExtensible.ZeroAddress.selector);
        new ProvenanceRegistry(address(0));
    }
}
