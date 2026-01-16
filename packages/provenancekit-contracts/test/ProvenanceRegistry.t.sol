// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {ProvenanceRegistry} from "../contracts/ProvenanceRegistry.sol";
import {ProvenanceVerifiable} from "../contracts/core/ProvenanceVerifiable.sol";
import {IProvenanceProvider} from "../contracts/interfaces/IProvenanceProvider.sol";

/**
 * @title ProvenanceRegistryTest
 * @notice Test suite for ProvenanceRegistry and the base architecture
 * @dev Tests the complete EAA model implementation
 */
contract ProvenanceRegistryTest is Test {
    ProvenanceRegistry public registry;

    // Test accounts
    address public alice;
    address public bob;
    address public aiAgent;

    // Test data
    string constant CID_IMAGE = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
    string constant CID_TEXT = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
    string constant ACTION_CREATE = "create";
    string constant ACTION_TRANSFORM = "transform";
    string constant RESOURCE_TYPE_IMAGE = "image";
    string constant ENTITY_ROLE_HUMAN = "human";
    string constant ENTITY_ROLE_AI = "ai";
    string constant ATTRIBUTION_ROLE_CREATOR = "creator";

    // Standard events (from IProvenanceProvider)
    event ActionRecorded(
        bytes32 indexed actionId,
        string actionType,
        address indexed performer,
        string[] inputs,
        string[] outputs,
        uint256 timestamp
    );

    event ResourceRegistered(
        string indexed cid,
        string resourceType,
        address indexed creator,
        bytes32 rootAction,
        uint256 timestamp
    );

    event EntityRegistered(
        address indexed entityAddress,
        string entityId,
        string entityRole,
        uint256 timestamp
    );

    event AttributionRecorded(
        string indexed cid,
        address indexed entityAddress,
        string role,
        uint256 timestamp
    );

    // Proof events (from ProvenanceVerifiable)
    event ActionVerified(
        bytes32 indexed actionId,
        ProvenanceVerifiable.ProofType proofType,
        bytes32 proofHash,
        address indexed verifiedBy
    );

    function setUp() public {
        // Deploy contract
        registry = new ProvenanceRegistry();

        // Setup test accounts
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        aiAgent = makeAddr("aiAgent");

        // Fund accounts with ETH
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(aiAgent, 10 ether);
    }

    /*//////////////////////////////////////////////////////////////
                          ENTITY REGISTRATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_RegisterEntity() public {
        vm.startPrank(alice);

        string memory entityId = "did:example:alice123";

        // Expect event emission
        vm.expectEmit(true, false, false, true);
        emit EntityRegistered(
            alice,
            entityId,
            ENTITY_ROLE_HUMAN,
            block.timestamp
        );

        registry.registerEntity(entityId, ENTITY_ROLE_HUMAN);

        // Verify entity exists
        assertTrue(registry.entityExists(alice));
        assertEq(registry.getEntityId(alice), entityId);
        assertEq(registry.getEntityRole(alice), ENTITY_ROLE_HUMAN);

        vm.stopPrank();
    }

    function test_RegisterAIEntity() public {
        vm.startPrank(aiAgent);

        string memory entityId = "agent:openai:gpt4";

        registry.registerEntity(entityId, ENTITY_ROLE_AI);

        assertTrue(registry.entityExists(aiAgent));
        assertEq(registry.getEntityId(aiAgent), entityId);
        assertEq(registry.getEntityRole(aiAgent), ENTITY_ROLE_AI);

        vm.stopPrank();
    }

    function test_RevertWhen_RegisterEntityTwice() public {
        vm.startPrank(alice);

        string memory entityId = "did:example:alice123";
        registry.registerEntity(entityId, ENTITY_ROLE_HUMAN);

        // Should revert
        vm.expectRevert(
            abi.encodeWithSelector(
                ProvenanceRegistry.EntityAlreadyExists.selector,
                alice
            )
        );
        registry.registerEntity(entityId, ENTITY_ROLE_HUMAN);

        vm.stopPrank();
    }

    function test_RevertWhen_RegisterEntityWithEmptyId() public {
        vm.startPrank(alice);

        vm.expectRevert(ProvenanceRegistry.EmptyEntityId.selector);
        registry.registerEntity("", ENTITY_ROLE_HUMAN);

        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                          ACTION RECORDING TESTS
    //////////////////////////////////////////////////////////////*/

    function test_RecordAction() public {
        vm.startPrank(alice);

        string[] memory inputs = new string[](0);
        string[] memory outputs = new string[](1);
        outputs[0] = CID_IMAGE;

        // Record action and get ID
        bytes32 actionId = registry.recordAction(
            ACTION_CREATE,
            inputs,
            outputs
        );

        // Verify action exists
        assertTrue(registry.actionExists(actionId));

        vm.stopPrank();
    }

    function test_RecordActionEmitsEvent() public {
        vm.startPrank(alice);

        string[] memory inputs = new string[](0);
        string[] memory outputs = new string[](1);
        outputs[0] = CID_IMAGE;

        // We can't predict the exact actionId due to nonce, so just check event is emitted
        vm.expectEmit(false, true, false, false);
        emit ActionRecorded(
            bytes32(0), // actionId - don't check
            ACTION_CREATE,
            alice,
            inputs,
            outputs,
            block.timestamp
        );

        registry.recordAction(ACTION_CREATE, inputs, outputs);

        vm.stopPrank();
    }

    function test_RecordActionWithInputs() public {
        vm.startPrank(alice);

        string[] memory inputs = new string[](1);
        inputs[0] = CID_TEXT;
        string[] memory outputs = new string[](1);
        outputs[0] = CID_IMAGE;

        bytes32 actionId = registry.recordAction(
            ACTION_TRANSFORM,
            inputs,
            outputs
        );

        assertTrue(registry.actionExists(actionId));

        vm.stopPrank();
    }

    function test_RevertWhen_RecordActionWithEmptyType() public {
        vm.startPrank(alice);

        string[] memory inputs = new string[](0);
        string[] memory outputs = new string[](0);

        vm.expectRevert();
        registry.recordAction("", inputs, outputs);

        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                        RESOURCE REGISTRATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_RegisterResource() public {
        vm.startPrank(alice);

        // First record an action
        string[] memory inputs = new string[](0);
        string[] memory outputs = new string[](1);
        outputs[0] = CID_IMAGE;

        bytes32 actionId = registry.recordAction(
            ACTION_CREATE,
            inputs,
            outputs
        );

        // Register the resource
        registry.registerResource(
            CID_IMAGE,
            RESOURCE_TYPE_IMAGE,
            actionId
        );

        // Verify resource exists
        assertTrue(registry.resourceExists(CID_IMAGE));
        assertEq(registry.getResourceCreator(CID_IMAGE), alice);
        assertEq(registry.getResourceRootAction(CID_IMAGE), actionId);

        vm.stopPrank();
    }

    function test_RegisterResourceEmitsEvent() public {
        vm.startPrank(alice);

        bytes32 actionId = keccak256("action");

        vm.expectEmit(true, true, false, true);
        emit ResourceRegistered(
            CID_IMAGE,
            RESOURCE_TYPE_IMAGE,
            alice,
            actionId,
            block.timestamp
        );

        registry.registerResource(
            CID_IMAGE,
            RESOURCE_TYPE_IMAGE,
            actionId
        );

        vm.stopPrank();
    }

    function test_RevertWhen_RegisterResourceWithEmptyCID() public {
        vm.startPrank(alice);

        bytes32 actionId = keccak256("action");

        vm.expectRevert(ProvenanceRegistry.EmptyCID.selector);
        registry.registerResource("", RESOURCE_TYPE_IMAGE, actionId);

        vm.stopPrank();
    }

    function test_RevertWhen_RegisterResourceTwice() public {
        vm.startPrank(alice);

        bytes32 actionId = keccak256("action");

        registry.registerResource(CID_IMAGE, RESOURCE_TYPE_IMAGE, actionId);

        vm.expectRevert(
            abi.encodeWithSelector(
                ProvenanceRegistry.ResourceAlreadyExists.selector,
                CID_IMAGE
            )
        );
        registry.registerResource(CID_IMAGE, RESOURCE_TYPE_IMAGE, actionId);

        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                          ATTRIBUTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_RecordAttribution() public {
        vm.startPrank(alice);

        vm.expectEmit(true, true, false, true);
        emit AttributionRecorded(
            CID_IMAGE,
            alice,
            ATTRIBUTION_ROLE_CREATOR,
            block.timestamp
        );

        registry.recordAttribution(CID_IMAGE, ATTRIBUTION_ROLE_CREATOR);

        vm.stopPrank();
    }

    function test_RecordAttributionFor() public {
        vm.startPrank(alice);

        vm.expectEmit(true, true, false, true);
        emit AttributionRecorded(
            CID_IMAGE,
            bob,
            "contributor",
            block.timestamp
        );

        registry.recordAttributionFor(CID_IMAGE, bob, "contributor");

        vm.stopPrank();
    }

    function test_RevertWhen_RecordAttributionWithEmptyCID() public {
        vm.startPrank(alice);

        vm.expectRevert(ProvenanceRegistry.EmptyCID.selector);
        registry.recordAttribution("", ATTRIBUTION_ROLE_CREATOR);

        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                       CONVENIENCE FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_RecordActionAndRegisterOutputs() public {
        vm.startPrank(alice);

        string[] memory inputs = new string[](1);
        inputs[0] = CID_TEXT;
        string[] memory outputs = new string[](2);
        outputs[0] = CID_IMAGE;
        outputs[1] = "QmSecondOutput";

        bytes32 actionId = registry.recordActionAndRegisterOutputs(
            ACTION_CREATE,
            inputs,
            outputs,
            RESOURCE_TYPE_IMAGE
        );

        // Verify action exists
        assertTrue(registry.actionExists(actionId));

        // Verify both resources registered
        assertTrue(registry.resourceExists(CID_IMAGE));
        assertTrue(registry.resourceExists("QmSecondOutput"));
        assertEq(registry.getResourceRootAction(CID_IMAGE), actionId);
        assertEq(registry.getResourceRootAction("QmSecondOutput"), actionId);

        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                        INTEGRATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_CompleteProvenanceFlow() public {
        // 1. Register entities
        vm.prank(alice);
        registry.registerEntity("did:alice", ENTITY_ROLE_HUMAN);

        vm.prank(aiAgent);
        registry.registerEntity("agent:gpt4", ENTITY_ROLE_AI);

        // 2. Record action (AI generates image from text)
        vm.startPrank(aiAgent);

        string[] memory inputs = new string[](1);
        inputs[0] = CID_TEXT; // Text prompt
        string[] memory outputs = new string[](1);
        outputs[0] = CID_IMAGE; // Generated image

        bytes32 actionId = registry.recordAction(
            ACTION_CREATE,
            inputs,
            outputs
        );

        // 3. Register resource
        registry.registerResource(CID_IMAGE, RESOURCE_TYPE_IMAGE, actionId);

        vm.stopPrank();

        // 4. Record attributions
        vm.prank(alice);
        registry.recordAttribution(CID_IMAGE, "contributor");

        vm.prank(aiAgent);
        registry.recordAttribution(CID_IMAGE, ATTRIBUTION_ROLE_CREATOR);

        // Verify complete flow
        assertTrue(registry.entityExists(alice));
        assertTrue(registry.entityExists(aiAgent));
        assertTrue(registry.actionExists(actionId));
        assertTrue(registry.resourceExists(CID_IMAGE));
        assertEq(registry.getResourceCreator(CID_IMAGE), aiAgent);
    }

    /*//////////////////////////////////////////////////////////////
                          ERC-165 TESTS
    //////////////////////////////////////////////////////////////*/

    function test_SupportsInterface() public view {
        // Should support IProvenanceProvider
        assertTrue(registry.supportsInterface(type(IProvenanceProvider).interfaceId));

        // Should support ERC-165
        assertTrue(registry.supportsInterface(0x01ffc9a7));
    }

    /*//////////////////////////////////////////////////////////////
                            FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    function testFuzz_RecordAction(string calldata actionType) public {
        // Skip empty action type (should revert)
        vm.assume(bytes(actionType).length > 0);

        vm.startPrank(alice);

        string[] memory inputs = new string[](0);
        string[] memory outputs = new string[](0);

        bytes32 actionId = registry.recordAction(actionType, inputs, outputs);

        assertTrue(registry.actionExists(actionId));

        vm.stopPrank();
    }

    function testFuzz_RegisterResource(
        string calldata cid,
        string calldata resourceType
    ) public {
        // Skip empty CID (should revert)
        vm.assume(bytes(cid).length > 0);

        vm.startPrank(alice);

        bytes32 actionId = keccak256("action");

        registry.registerResource(cid, resourceType, actionId);
        assertTrue(registry.resourceExists(cid));

        vm.stopPrank();
    }

    function testFuzz_RegisterEntity(
        string calldata entityId,
        string calldata role
    ) public {
        // Skip empty entityId (should revert)
        vm.assume(bytes(entityId).length > 0);

        vm.startPrank(alice);

        registry.registerEntity(entityId, role);
        assertTrue(registry.entityExists(alice));
        assertEq(registry.getEntityId(alice), entityId);

        vm.stopPrank();
    }
}

/**
 * @title ProvenanceVerifiableTest
 * @notice Test suite for ProvenanceVerifiable proof layer
 */
contract ProvenanceVerifiableTest is Test {
    ProvenanceRegistry public registry;

    address public alice;
    uint256 public alicePrivateKey;

    string constant CID_IMAGE = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

    function setUp() public {
        registry = new ProvenanceRegistry();

        // Create account with known private key for signing
        alicePrivateKey = 0xA11CE;
        alice = vm.addr(alicePrivateKey);
        vm.deal(alice, 10 ether);
    }

    function test_RecordActionWithCommitment() public {
        vm.startPrank(alice);

        string[] memory inputs = new string[](0);
        string[] memory outputs = new string[](1);
        outputs[0] = CID_IMAGE;

        bytes32 commitment = keccak256(abi.encodePacked("secret data", bytes32(uint256(123))));

        bytes32 actionId = registry.recordActionWithCommitment(
            "create",
            inputs,
            outputs,
            commitment
        );

        assertTrue(registry.actionExists(actionId));
        assertTrue(registry.hasProof(actionId));
        assertEq(registry.getActionProof(actionId), commitment);

        vm.stopPrank();
    }

    function test_RevealCommitment() public {
        vm.startPrank(alice);

        string[] memory inputs = new string[](0);
        string[] memory outputs = new string[](1);
        outputs[0] = CID_IMAGE;

        bytes memory revealData = "secret data";
        bytes32 salt = bytes32(uint256(123));
        bytes32 commitment = keccak256(abi.encodePacked(revealData, salt));

        bytes32 actionId = registry.recordActionWithCommitment(
            "create",
            inputs,
            outputs,
            commitment
        );

        // Reveal the commitment
        registry.revealCommitment(actionId, revealData, salt);

        assertTrue(registry.isCommitmentRevealed(commitment));

        vm.stopPrank();
    }

    function test_RevertWhen_InvalidReveal() public {
        vm.startPrank(alice);

        string[] memory inputs = new string[](0);
        string[] memory outputs = new string[](1);
        outputs[0] = CID_IMAGE;

        bytes32 commitment = keccak256(abi.encodePacked("secret data", bytes32(uint256(123))));

        bytes32 actionId = registry.recordActionWithCommitment(
            "create",
            inputs,
            outputs,
            commitment
        );

        // Try to reveal with wrong data
        vm.expectRevert(ProvenanceVerifiable.InvalidReveal.selector);
        registry.revealCommitment(actionId, "wrong data", bytes32(uint256(123)));

        vm.stopPrank();
    }

    function test_RevertWhen_RevealTwice() public {
        vm.startPrank(alice);

        string[] memory inputs = new string[](0);
        string[] memory outputs = new string[](1);
        outputs[0] = CID_IMAGE;

        bytes memory revealData = "secret data";
        bytes32 salt = bytes32(uint256(123));
        bytes32 commitment = keccak256(abi.encodePacked(revealData, salt));

        bytes32 actionId = registry.recordActionWithCommitment(
            "create",
            inputs,
            outputs,
            commitment
        );

        // First reveal succeeds
        registry.revealCommitment(actionId, revealData, salt);

        // Second reveal fails
        vm.expectRevert(ProvenanceVerifiable.CommitmentAlreadyRevealed.selector);
        registry.revealCommitment(actionId, revealData, salt);

        vm.stopPrank();
    }
}
