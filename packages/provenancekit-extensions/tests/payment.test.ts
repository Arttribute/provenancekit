import { describe, it, expect } from "vitest";
import { cidRef, type Attribution, type Action } from "@provenancekit/eaa-types";
import {
  PAYMENT_NAMESPACE,
  PAYMENT_METHODS,
  PaymentExtension,
  PaymentRecipient,
  withPayment,
  getPayment,
  hasPayment,
  getPaymentAddress,
} from "../src/payment";

const createAttribution = (entityId: string = "alice"): Attribution => ({
  resourceRef: cidRef("bafytest123"),
  entityId,
  role: "creator",
});

const createAction = (): Action => ({
  type: "create",
  performedBy: "did:key:alice",
  timestamp: new Date().toISOString(),
  inputs: [],
  outputs: [],
});

describe("payment extension", () => {
  describe("PAYMENT_NAMESPACE", () => {
    it("has correct value", () => {
      expect(PAYMENT_NAMESPACE).toBe("ext:payment@1.0.0");
    });
  });

  describe("PAYMENT_METHODS", () => {
    it("has expected methods", () => {
      expect(PAYMENT_METHODS.STREAMING).toBe("streaming");
      expect(PAYMENT_METHODS.MICROPAYMENT).toBe("micropayment");
      expect(PAYMENT_METHODS.SPLIT).toBe("split");
      expect(PAYMENT_METHODS.DIRECT).toBe("direct");
      expect(PAYMENT_METHODS.MANUAL).toBe("manual");
    });
  });

  describe("PaymentRecipient schema", () => {
    it("validates minimal recipient", () => {
      const result = PaymentRecipient.safeParse({
        address: "0x1234567890abcdef1234567890abcdef12345678",
      });
      expect(result.success).toBe(true);
    });

    it("validates full recipient", () => {
      const result = PaymentRecipient.safeParse({
        address: "0x1234567890abcdef1234567890abcdef12345678",
        chainId: 8453,
        name: "alice.eth",
        network: "ethereum",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing address", () => {
      const result = PaymentRecipient.safeParse({
        chainId: 8453,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("PaymentExtension schema", () => {
    it("validates minimal payment config", () => {
      const result = PaymentExtension.safeParse({
        recipient: { address: "0x123" },
      });
      expect(result.success).toBe(true);
    });

    it("validates full payment config", () => {
      const result = PaymentExtension.safeParse({
        recipient: {
          address: "0x1234567890abcdef1234567890abcdef12345678",
          chainId: 8453,
          name: "alice.eth",
        },
        method: PAYMENT_METHODS.STREAMING,
        currency: "USDC",
        splitBps: 5000,
        minAmount: "1000000",
        config: { flowRate: "1000000000" },
      });
      expect(result.success).toBe(true);
    });

    it("validates splitBps range", () => {
      const valid = PaymentExtension.safeParse({
        recipient: { address: "0x123" },
        splitBps: 5000,
      });
      expect(valid.success).toBe(true);

      const tooLow = PaymentExtension.safeParse({
        recipient: { address: "0x123" },
        splitBps: -1,
      });
      expect(tooLow.success).toBe(false);

      const tooHigh = PaymentExtension.safeParse({
        recipient: { address: "0x123" },
        splitBps: 10001,
      });
      expect(tooHigh.success).toBe(false);
    });
  });

  describe("withPayment", () => {
    it("adds payment extension to attribution", () => {
      const attr = createAttribution();
      const result = withPayment(attr, {
        recipient: { address: "0x123", chainId: 8453 },
        method: PAYMENT_METHODS.STREAMING,
      });

      expect(result.extensions?.[PAYMENT_NAMESPACE]).toBeDefined();
      const payment = result.extensions?.[PAYMENT_NAMESPACE] as any;
      expect(payment.recipient.address).toBe("0x123");
      expect(payment.method).toBe("streaming");
    });

    it("adds payment extension to action", () => {
      const action = createAction();
      const result = withPayment(action, {
        recipient: { address: "0x456" },
        currency: "ETH",
      });

      expect(result.extensions?.[PAYMENT_NAMESPACE]).toBeDefined();
    });

    it("preserves existing properties", () => {
      const attr = createAttribution("bob");
      const result = withPayment(attr, {
        recipient: { address: "0x123" },
      });

      expect(result.entityId).toBe("bob");
      expect(result.role).toBe("creator");
    });

    it("preserves existing extensions", () => {
      const attr: Attribution = {
        ...createAttribution(),
        extensions: { "ext:other": { value: 42 } },
      };
      const result = withPayment(attr, {
        recipient: { address: "0x123" },
      });

      expect(result.extensions?.["ext:other"]).toEqual({ value: 42 });
    });

    it("validates input", () => {
      const attr = createAttribution();
      expect(() =>
        withPayment(attr, { recipient: {} } as any)
      ).toThrow();
    });
  });

  describe("getPayment", () => {
    it("returns payment extension when present", () => {
      const attr = withPayment(createAttribution(), {
        recipient: { address: "0x123", chainId: 8453 },
        method: PAYMENT_METHODS.SPLIT,
        currency: "USDC",
      });

      const payment = getPayment(attr);

      expect(payment).toBeDefined();
      expect(payment?.recipient.address).toBe("0x123");
      expect(payment?.recipient.chainId).toBe(8453);
      expect(payment?.method).toBe("split");
      expect(payment?.currency).toBe("USDC");
    });

    it("returns undefined when not present", () => {
      const attr = createAttribution();
      expect(getPayment(attr)).toBeUndefined();
    });

    it("works with actions", () => {
      const action = withPayment(createAction(), {
        recipient: { address: "0x789" },
      });

      const payment = getPayment(action);
      expect(payment?.recipient.address).toBe("0x789");
    });
  });

  describe("hasPayment", () => {
    it("returns true when payment extension exists", () => {
      const attr = withPayment(createAttribution(), {
        recipient: { address: "0x123" },
      });

      expect(hasPayment(attr)).toBe(true);
    });

    it("returns false when payment extension does not exist", () => {
      expect(hasPayment(createAttribution())).toBe(false);
    });
  });

  describe("getPaymentAddress", () => {
    it("returns address from payment extension", () => {
      const attr = withPayment(createAttribution(), {
        recipient: { address: "0xabcdef" },
      });

      expect(getPaymentAddress(attr)).toBe("0xabcdef");
    });

    it("returns undefined when no payment extension", () => {
      expect(getPaymentAddress(createAttribution())).toBeUndefined();
    });
  });

  describe("custom payment methods", () => {
    it("accepts any string as payment method", () => {
      const attr = withPayment(createAttribution(), {
        recipient: { address: "lnbc1..." },
        method: "lightning",
        config: { invoiceExpiry: 3600 },
      });

      const payment = getPayment(attr);
      expect(payment?.method).toBe("lightning");
    });

    it("supports Bitcoin Lightning network", () => {
      const attr = withPayment(createAttribution(), {
        recipient: {
          address: "lnbc1pvjluezsp5...",
          network: "lightning",
        },
        method: "lightning",
        currency: "BTC",
      });

      const payment = getPayment(attr);
      expect(payment?.recipient.network).toBe("lightning");
      expect(payment?.currency).toBe("BTC");
    });
  });
});
