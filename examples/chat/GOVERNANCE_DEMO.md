# Governance Demo Scenario

## Scenario

Record a Human-AI creation workflow for a public health campaign where the final
poster/caption depends on multiple sources with different governance conditions:

- `creator-brief.md`: human-original creative direction
- `licensed-style-guide.md`: licensed third-party style rules
- `restricted-patient-note.txt`: restricted personal/medical context requiring review

## Recording Flow

1. Start a new chat conversation.
2. Upload all three files from `examples/chat/demo/governance`.
3. Set attachment governance:
   - `creator-brief.md` -> Original
   - `licensed-style-guide.md` -> Licensed source
   - `restricted-patient-note.txt` -> Restricted source
4. For files with no prior provenance, answer the provenance claim prompt:
   - Original file: Yes
   - Licensed source: No
   - Restricted source: No
5. Send this prompt:

```text
Create a governance-safe poster concept and caption for the Aurora Health campaign.
Use the creator brief and licensed style guide, but do not quote or identify the
restricted patient note. Explain what governance review is still required before publication.
Then generate one poster-style image.
```

6. Open the Session Provenance drawer.

## What The Demo Shows

- R1: Human upload, prompt, AI response, and image generation are separate typed actions.
- R2: Uploaded sources and outputs carry machine-readable licence and AI-training reservation metadata.
- R3: The assistant response and generated image link back to source CIDs and prompt CIDs.
- R4: AI model/tool involvement is recorded through `ext:ai@1.0.0`.
- R5: Restricted source use is marked with pending authorisation and review status.
- R6: The drawer surfaces governance claims without exposing full private workflow detail.

## Defense Talking Point

The demo is intentionally not just "AI chat with provenance." It shows the thesis claim:
governance depends on reconstructable workflow evidence, not final-output detection. The
same final poster can be assessed for human contribution, source dependency, licence status,
AI disclosure, and consent risk because each operation and artefact is recorded with
governance-specific metadata.
