/**
 * MongoDB document types for the Canvas social platform.
 *
 * ProvenanceKit integration model:
 *   Canvas is a platform app with ONE server-side PK API key (PROVENANCEKIT_API_KEY env).
 *   All users are entities within the Canvas PK project.
 *   entityId = user.privyDid (stable, globally unique).
 */

export interface CanvasUser {
  _id: string;
  privyDid: string;
  wallet?: string;             // primary EVM wallet for payments
  username: string;
  displayName: string;
  bio?: string;
  avatar?: string;             // IPFS CID or URL
  banner?: string;             // IPFS CID or URL
  followersCount: number;
  followingCount: number;
  postsCount: number;
  /** PK entity ID — set on first provenance-tracked post (= privyDid) */
  provenanceEntityId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Safe user profile for public API responses (no sensitive fields) */
export interface PublicUser {
  _id: string;
  privyDid: string;
  username: string;
  displayName: string;
  bio?: string;
  avatar?: string;
  banner?: string;
  wallet?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  provenanceEntityId?: string;
  createdAt: Date;
  isFollowing?: boolean;       // populated by feed/profile endpoints
}

export type PostType = "text" | "image" | "video" | "audio" | "blog" | "remix";

export interface MediaRef {
  cid: string;                  // IPFS CID (pinned via Pinata)
  url?: string;                 // Pinata gateway URL
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number;            // seconds, for audio/video
  size?: number;                // bytes
  provenanceCid?: string;       // C2PA provenance CID
}

export interface Post {
  _id: string;
  authorId: string;             // Privy DID
  authorUsername?: string;      // denormalized for display
  authorDisplayName?: string;   // denormalized for display
  authorAvatar?: string;        // denormalized for display
  type: PostType;
  content: string;
  mediaRefs: MediaRef[];

  // For remixes
  originalPostId?: string;
  originalAuthorId?: string;    // denormalized
  remixNote?: string;           // attribution note

  // ProvenanceKit — recorded via platform PROVENANCEKIT_API_KEY
  provenanceCid?: string;       // PK resource CID for this post's content
  actionId?: string;            // PK action ID for creation/remix
  provenanceStatus?: "verified" | "partial" | "unverified" | "pending" | "none";

  // Monetization
  splitsContract?: string;      // 0xSplits contract address on Base
  isPremium: boolean;
  x402Price?: string;           // USDC amount for premium access

  // License
  licenseType?: string;         // e.g. "CC-BY-4.0"
  aiTraining?: "permitted" | "reserved" | "unspecified";

  tags: string[];
  likesCount: number;
  commentsCount: number;
  remixCount: number;
  viewCount: number;

  isPublished: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  _id: string;
  postId: string;
  authorId: string;             // Privy DID
  authorUsername?: string;      // denormalized
  authorDisplayName?: string;   // denormalized
  authorAvatar?: string;        // denormalized
  content: string;
  likesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Follow {
  _id: string;
  followerId: string;           // Privy DID
  followingId: string;          // Privy DID
  createdAt: Date;
}

export interface Like {
  _id: string;
  userId: string;               // Privy DID
  postId: string;
  createdAt: Date;
}

export interface CreatorEarning {
  _id: string;
  userId: string;
  postId: string;
  amount: string;               // USDC units (6 decimals, as string)
  currency: string;             // "USDC" | "ETH"
  txHash: string;
  chainId: number;
  distributedAt: Date;
  type: "sale" | "view" | "subscription" | "tip" | "split";
}

export interface SplitsContract {
  _id: string;
  postId: string;
  contractAddress: string;
  chainId: number;
  recipients: Array<{
    entityId: string;           // PK entity ID
    wallet: string;
    share: number;              // basis points (0-10000)
  }>;
  deployedAt: Date;
  deployedBy: string;
}
