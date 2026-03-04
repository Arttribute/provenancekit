/**
 * MongoDB document types for the Canvas social platform.
 */

export interface CanvasUser {
  _id: string;
  privyDid: string;
  wallet?: string;             // primary EVM wallet for payments
  username: string;
  displayName: string;
  bio?: string;
  avatar?: string;
  banner?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  provenancekitApiKey?: string; // encrypted
  provenancekitApiUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PostType = "text" | "image" | "video" | "audio" | "blog" | "remix";

export interface MediaRef {
  cid: string;                  // IPFS CID
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number;
  provenanceCid?: string;       // C2PA provenance CID
}

export interface Post {
  _id: string;
  authorId: string;
  type: PostType;
  content: string;
  mediaRefs: MediaRef[];

  // For remixes
  originalPostId?: string;
  remixNote?: string;           // attribution note

  // ProvenanceKit
  provenanceCid?: string;       // PK resource CID for this post
  actionId?: string;            // PK action ID for creation/remix

  // Monetization
  splitsContract?: string;      // 0xSplits contract address
  isPremium: boolean;
  x402Price?: string;           // USDC amount for premium access

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
  authorId: string;
  content: string;
  likesCount: number;
  createdAt: Date;
}

export interface Follow {
  _id: string;
  followerId: string;
  followingId: string;
  createdAt: Date;
}

export interface CreatorEarning {
  _id: string;
  userId: string;
  postId: string;
  amount: string;               // wei or USDC units
  currency: string;             // "USDC" | "ETH"
  txHash: string;
  chainId: number;
  distributedAt: Date;
  type: "sale" | "view" | "subscription" | "tip";
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
