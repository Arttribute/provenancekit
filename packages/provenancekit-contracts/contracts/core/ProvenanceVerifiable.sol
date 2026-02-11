// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ProvenanceCore} from "./ProvenanceCore.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title ProvenanceVerifiable
 * @author ProvenanceKit
 * @notice Extends ProvenanceCore with cryptographic proof capabilities
 * @dev This layer adds verification and proof mechanisms to provenance records.
 *      It sits between ProvenanceCore and application-level extensions.
 *
 *      This is OPTIONAL but STRONGLY RECOMMENDED for production use.
 *
 *      Features:
 *      - Signature-based proofs (ECDSA)
 *      - Commitment schemes (for future ZK integration)
 *      - Proof verification hooks
 *      - Action data hashing for integrity
 *
 *      Proof types supported:
 *      - SIGNATURE: ECDSA signature of action data
 *      - COMMITMENT: Hash commitment (for ZK reveal later)
 *      - NONE: No proof (for trusted environments)
 *
 *      Example usage:
 *      ```solidity
 *      contract MyProvenance is ProvenanceVerifiable {
 *          constructor() {
 *              // Require signature proofs
 *          }
 *      }
 *      ```
 */
abstract contract ProvenanceVerifiable is ProvenanceCore {
    /*//////////////////////////////////////////////////////////////
                                TYPES
    //////////////////////////////////////////////////////////////*/

    /// @notice Types of proofs supported
    enum ProofType {
        NONE,       // No proof required
        SIGNATURE,  // ECDSA signature
        COMMITMENT  // Hash commitment (ZK-friendly)
    }

    /// @notice Proof data structure
    struct Proof {
        ProofType proofType;
        bytes data;         // Signature bytes or commitment hash
        address signer;     // For signature proofs: expected signer
    }

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Emitted when a verified action is recorded
     * @param actionId The action that was verified
     * @param proofType Type of proof used
     * @param proofHash Hash of the proof data
     * @param verifiedBy Address that verified (signer for signatures)
     */
    event ActionVerified(
        bytes32 indexed actionId,
        ProofType proofType,
        bytes32 proofHash,
        address indexed verifiedBy
    );

    /**
     * @notice Emitted when a commitment is revealed
     * @param actionId The action being revealed
     * @param commitment Original commitment hash
     * @param revealedData The revealed data
     */
    event CommitmentRevealed(
        bytes32 indexed actionId,
        bytes32 commitment,
        bytes revealedData
    );

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @dev Mapping from action ID to its proof
    mapping(bytes32 => bytes32) private _actionProofs;

    /// @dev Mapping from action ID to proof type
    mapping(bytes32 => ProofType) private _actionProofTypes;

    /// @dev Mapping from commitment to whether it's been revealed
    mapping(bytes32 => bool) private _revealedCommitments;

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @notice Thrown when signature verification fails
    error InvalidSignature();

    /// @notice Thrown when proof type is invalid
    error InvalidProofType();

    /// @notice Thrown when commitment has already been revealed
    error CommitmentAlreadyRevealed();

    /// @notice Thrown when reveal data doesn't match commitment
    error InvalidReveal();

    /*//////////////////////////////////////////////////////////////
                         VERIFIED RECORDING
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Record an action with cryptographic proof
     * @dev Use this instead of recordAction when proof is required.
     *
     * @param actionType Type of action
     * @param inputs Input CIDs
     * @param outputs Output CIDs
     * @param proof Proof data (signature or commitment)
     * @return actionId The recorded action ID
     */
    function recordActionWithProof(
        string calldata actionType,
        string[] calldata inputs,
        string[] calldata outputs,
        Proof calldata proof
    ) external virtual returns (bytes32 actionId) {
        // Verify proof before recording
        _verifyProof(actionType, inputs, outputs, proof);

        // Record the action using parent (internal call preserves msg.sender)
        actionId = recordAction(actionType, inputs, outputs);

        // Store proof reference
        bytes32 proofHash = keccak256(proof.data);
        _actionProofs[actionId] = proofHash;
        _actionProofTypes[actionId] = proof.proofType;

        // Emit verification event
        emit ActionVerified(
            actionId,
            proof.proofType,
            proofHash,
            proof.proofType == ProofType.SIGNATURE ? proof.signer : msg.sender
        );

        return actionId;
    }

    /**
     * @notice Record an action with a commitment (for later ZK reveal)
     * @dev The commitment can be revealed later with revealCommitment()
     *
     * @param actionType Type of action
     * @param inputs Input CIDs
     * @param outputs Output CIDs
     * @param commitment Hash commitment of hidden data
     * @return actionId The recorded action ID
     */
    function recordActionWithCommitment(
        string calldata actionType,
        string[] calldata inputs,
        string[] calldata outputs,
        bytes32 commitment
    ) external virtual returns (bytes32 actionId) {
        // Record the action (internal call preserves msg.sender)
        actionId = recordAction(actionType, inputs, outputs);

        // Store commitment
        _actionProofs[actionId] = commitment;
        _actionProofTypes[actionId] = ProofType.COMMITMENT;

        emit ActionVerified(
            actionId,
            ProofType.COMMITMENT,
            commitment,
            msg.sender
        );

        return actionId;
    }

    /**
     * @notice Reveal a previously committed value
     * @dev Verifies the reveal matches the commitment
     *
     * @param actionId The action with the commitment
     * @param revealData The data being revealed
     * @param salt Salt used in the commitment
     */
    function revealCommitment(
        bytes32 actionId,
        bytes calldata revealData,
        bytes32 salt
    ) external virtual {
        bytes32 commitment = _actionProofs[actionId];

        // Check commitment exists and is correct type
        if (_actionProofTypes[actionId] != ProofType.COMMITMENT) {
            revert InvalidProofType();
        }

        // Check not already revealed
        if (_revealedCommitments[commitment]) {
            revert CommitmentAlreadyRevealed();
        }

        // Verify reveal matches commitment
        bytes32 computedCommitment = keccak256(abi.encodePacked(revealData, salt));
        if (computedCommitment != commitment) {
            revert InvalidReveal();
        }

        // Mark as revealed
        _revealedCommitments[commitment] = true;

        emit CommitmentRevealed(actionId, commitment, revealData);
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get the proof hash for an action
     * @param actionId The action ID
     * @return The proof hash (signature hash or commitment)
     */
    function getActionProof(bytes32 actionId) external view returns (bytes32) {
        return _actionProofs[actionId];
    }

    /**
     * @notice Get the proof type for an action
     * @param actionId The action ID
     * @return The proof type
     */
    function getProofType(bytes32 actionId) external view returns (ProofType) {
        return _actionProofTypes[actionId];
    }

    /**
     * @notice Check if a commitment has been revealed
     * @param commitment The commitment hash
     * @return True if revealed
     */
    function isCommitmentRevealed(bytes32 commitment) external view returns (bool) {
        return _revealedCommitments[commitment];
    }

    /**
     * @notice Check if an action has a valid proof
     * @param actionId The action ID
     * @return True if the action has a proof attached
     */
    function hasProof(bytes32 actionId) external view returns (bool) {
        return _actionProofTypes[actionId] != ProofType.NONE;
    }

    /*//////////////////////////////////////////////////////////////
                         INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Verify a proof
     * @dev Override to add custom verification logic
     *
     * @param actionType Type of action
     * @param inputs Input CIDs
     * @param outputs Output CIDs
     * @param proof Proof to verify
     */
    function _verifyProof(
        string calldata actionType,
        string[] calldata inputs,
        string[] calldata outputs,
        Proof calldata proof
    ) internal virtual {
        if (proof.proofType == ProofType.NONE) {
            // No verification needed
            return;
        }

        if (proof.proofType == ProofType.SIGNATURE) {
            // Verify ECDSA signature using OpenZeppelin (includes malleability protection)
            bytes32 messageHash = _hashActionData(actionType, inputs, outputs);
            bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
            address recovered = ECDSA.recover(ethSignedHash, proof.data);

            if (recovered != proof.signer) {
                revert InvalidSignature();
            }
        }

        // COMMITMENT type doesn't need verification at record time
        // It's verified at reveal time
    }

    /**
     * @notice Hash action data for signing
     * @param actionType Type of action
     * @param inputs Input CIDs
     * @param outputs Output CIDs
     * @return Hash of the action data
     */
    function _hashActionData(
        string calldata actionType,
        string[] calldata inputs,
        string[] calldata outputs
    ) internal view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                address(this),
                msg.sender,
                actionType,
                keccak256(abi.encode(inputs)),
                keccak256(abi.encode(outputs))
            )
        );
    }
}
