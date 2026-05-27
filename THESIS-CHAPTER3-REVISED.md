# Chapter 3: Research Methodology (Revised)

---

## 3.1 Introduction

This chapter presents the methodology adopted for the design, development, and evaluation of a provenance approach for Human-AI-created works. It identifies the research paradigm within which the study is situated, describes the overarching research design, and explains the specific methods used to translate legal and technical requirements into a working artefact and to evaluate that artefact against rigorously defined criteria. The chapter also describes the evaluation strategy and its limitations, including the use of an automated test suite — documented in full in Appendix A — as objective evidence of artefact quality.

---

## 3.2 Research Paradigm and Design Science Research

### Epistemological Positioning

This study is situated within the design science research (DSR) paradigm in information systems, as defined and formally established by Hevner, March, Park, and Ram (2004). In their foundational account, Hevner et al. (2004) distinguish DSR from the behavioural science paradigm by its primary objective: whereas behavioural science seeks to explain or predict social phenomena through the development and verification of theory, design science seeks to create and evaluate IT artefacts intended to solve identified organisational or socio-technical problems. As Hevner et al. (2004, p. 75) explain, design science is a problem-solving paradigm whose roots lie in engineering and the sciences of the artificial, and its outputs — constructs, models, methods, and instantiations — represent innovations that extend the boundaries of human and organisational capability.

Design science is an established research paradigm in information systems research (March & Smith, 1995) and has been applied extensively to the design of novel information infrastructure where normative requirements must be translated into working technical systems. It is appropriate for the present study because the primary objective is not to test a theory of Human-AI governance, but to produce and evaluate an artefact — a governance-oriented provenance approach — that addresses a clearly identified informational deficit at the intersection of law, data governance, and artificial intelligence. The problem is socio-technical in character: it arises from a mismatch between the informational demands of legal and regulatory frameworks and the capabilities of existing technical systems. DSR is the appropriate paradigm for research that addresses precisely this kind of mismatch by producing an evaluated artefact that demonstrates feasibility and informs future design.

Hevner (2007) extends the original framework by describing DSR as operating across three interrelated cycles. The **relevance cycle** grounds the research in a practical problem environment, drawing from stakeholder needs and the governance context to define the requirements the artefact must satisfy. The **rigour cycle** grounds the design process in accumulated knowledge — established theories, methods, and prior artefacts — ensuring that design choices contribute to and draw from the wider knowledge base. The **design cycle** mediates between the two: the researcher constructs and evaluates artefacts, generating new knowledge that feeds back into both the application environment and the knowledge base. The present study instantiates all three cycles explicitly: the relevance cycle is realised through the normative doctrinal analysis of Human-AI governance requirements (Section 3.3.1); the rigour cycle is realised through the systematic review of provenance systems and existing technical approaches to AI content traceability (Section 3.3.2); and the design cycle is realised through iterative construction and evaluation of the EAA model and its associated components.

Hevner et al. (2004) articulate seven guidelines that characterise rigorous design science research. These guidelines structure the choices made throughout this study:

1. **Design as an artefact**: the research must produce a viable IT artefact — a construct, model, method, or instantiation. This study satisfies the guideline through the EAA data model and its operational implementation as ProvenanceKit (provenancekit.com), a layered software system comprising a type library, smart contract hierarchy, storage adapters, privacy module, API, and typed SDK.

2. **Problem relevance**: the artefact must address a relevant, unsolved problem. Chapter 2 establishes, with reference to legal and regulatory analysis, that no existing technical system meets the governance requirements identified from EU and US copyright doctrine, the EU AI Act, the DSM Directive, and the GDPR.

3. **Design evaluation**: the utility, quality, and efficacy of the artefact must be rigorously demonstrated. This is addressed by the dual evaluation framework described in Section 3.2.5 and executed in Chapter 4, supplemented by the automated test suite reported in Appendix A.

4. **Research contributions**: the research must produce a clear, verifiable contribution. The contribution is a governance-oriented provenance specification whose informational requirements are derived from named legal instruments rather than generic data-management principles, ensuring traceable legal grounding for each design component.

5. **Research rigour**: methods must be applied rigorously in both construction and evaluation. This is addressed by the normative doctrinal analysis (Section 3.3.1), the examination of existing provenance systems (Section 3.3.2), and the pre-specified, independently derived evaluation frameworks (Section 3.3.3).

6. **Design as a search process**: the design process must engage in a principled search for an effective artefact. The layered architecture reflects iterative design choices — including the decision to keep the EAA base model minimal, to derive extension namespaces from specific legal instruments, and to implement privacy as an architectural property rather than an add-on — each of which is documented with its rationale in Chapter 4.

7. **Communication of research**: the research must be communicated to both technology-oriented and management-oriented audiences. This thesis addresses both, as does the ProvenanceKit documentation at docs.provenancekit.com and the operational demonstration at chat.provenancekit.com.

### Process Model

The procedural structure of the research follows the Design Science Research Methodology (DSRM) process model proposed by Peffers, Tuunanen, Rothenberger, and Chatterjee (2007–2008). That model organises DSR activity into six sequential and interrelated stages: problem identification and motivation; definition of objectives; design and development; demonstration; evaluation; and communication. Peffers et al. (2007–2008) note that while the stages are presented sequentially, the process is iterative in practice: later stages may reveal information that requires revisiting earlier design decisions. The model was selected because its stage structure is well suited to research that proceeds from normative analysis through to technical implementation and structured evaluation, and because its outputs are clearly delineated, facilitating the explicit reporting required by Hevner et al.'s (2004) guideline on communication.

---

## 3.2.1 Problem Identification and Motivation

This stage entailed defining and conceptually decomposing the problem of attribution and the assignment of credit and responsibility for Human-AI-created works. In keeping with Hevner et al.'s (2004) relevance cycle, the problem was grounded simultaneously in legal and regulatory requirements and in the capabilities of existing technical systems.

Effective allocation of credit or accountability for the outcome of a creative process requires a granular understanding of the process itself, including what contributed to it and the extent of those contributions. The key challenge identified is the absence of a workflow-level, interoperable, and governance-oriented approach for tracking Human-AI creation processes. Existing approaches — AI detection tools, watermarking mechanisms, and asset-centric authenticity systems — each address a part of this problem in isolation but do not collectively provide an integrated solution that meets the informational demands of copyright doctrine, AI disclosure regulation, and data governance simultaneously. This problem identification was informed by the legal and technical analysis documented in Chapter 2.

---

## 3.2.2 Definition of Objectives

The objectives of the proposed artefact were derived from the problem definition and from consideration of what is technically and legally feasible within the scope of the study. Four core objectives were established.

First, the approach must provide sufficient granularity to track the details necessary for effective attribution, credit allocation, and accountability throughout the creation process, distinguishing human from AI participation at the level of individual operations rather than only at the level of the finished artefact. Second, the approach must be interoperable with established information systems and provenance representation standards — in particular W3C PROV and C2PA — so as to support broad applicability across heterogeneous Human-AI environments. Third, the approach must adhere to applicable data governance frameworks, implementing selective and cryptographically verifiable disclosure rather than requiring unrestricted access to workflow data. Fourth, the approach must support the enforcement or assessment of entitlements and liability by encoding rights reservations and authorisation conditions as first-order, machine-readable provenance metadata queryable by content identifier.

These four objectives were operationalised as six functional requirements (R1–R6), documented in full in Chapter 4, which serve as the primary evaluative basis for assessing the completed artefact.

---

## 3.2.3 Design and Development

The design and development stage produced an artefact comprising a conceptual provenance approach and an accompanying technical implementation, referred to throughout this study as ProvenanceKit. The artefact is organised as a layered, modular system spanning six implementation packages and two application layers.

The conceptual core is the Entity-Action-Attribution (EAA) data model, which represents entities, actions, content resources, derivation relationships, and attribution structures within Human-AI creation workflows. The model is intentionally minimal, defining provenance structure without embedding domain-specific governance semantics. Governance-specific metadata is added through a typed extension system in which structured metadata blocks are attached to any EAA record under a versioned namespace key of the form ext:namespace@semver; this preserves a stable, interoperable core while permitting governance-relevant metadata to evolve independently.

In addition to the EAA model and extensibility system, the artefact includes a privacy module implementing five mechanisms — encryption at rest, selective claim disclosure, Pedersen commitments, token-gated access control, and encrypted vector search — using audited cryptographic primitives from the @noble/ciphers library; a four-layer smart contract hierarchy deployable on any EVM-compatible blockchain; four database adapters and six file-storage adapters exposing a unified pluggable storage interface; an indexer bridging the on-chain event log to queryable off-chain storage; a REST API exposing provenance recording and retrieval over two authenticated namespaces; and a typed client SDK that performs file upload, content-addressing, off-chain provenance recording, and optional on-chain anchoring in a single call.

At each design stage, choices were informed both by the governance requirements derived from the legal analysis and by prior provenance systems reviewed in the rigour cycle. The design choices and their legal and technical rationale are documented in Chapter 4.

---

## 3.2.4 Demonstration

The operational implementation was demonstrated in two prototype applications representing distinct governance scenarios, developed as part of the ProvenanceKit platform.

The first is a multi-provider conversational AI application, available at chat.provenancekit.com, in which provenance is recorded as a side effect of response generation. On completion of each AI response, a provide action is recorded attributing the human prompt to a human-typed entity, and a generate action is recorded attributing the AI response to an AI-typed entity, with ext:ai@1.0.0 specifying provider, model, prompt fingerprint, and token counts. Image generation additionally records a derivation action linking the textual prompt content identifier (CID) to the generated image CID. A provenance badge is rendered on every AI message and a dedicated explorer surfaces the full provenance graph for each conversation. The second application is a social content platform with media upload, licensing, and remix tracking, in which derivation chains and rights metadata are captured across multi-step creation workflows. Both applications were developed by the approach's authors; they establish functional deployability in representative Human-AI environments rather than constituting independent third-party validation.

The demonstration environments were selected to instantiate the full range of governance scenarios identified in the problem definition: AI involvement disclosure (R4), derivation chain construction (R3), per-actor attribution (R1), machine-readable rights reservation metadata (R2), and artefact-level authorisation documentation (R5).

---

## 3.2.5 Evaluation

The evaluation stage assessed the extent to which the proposed approach satisfied the objectives defined in Section 3.2.2, following Hevner et al.'s (2004) guideline that the utility, quality, and efficacy of a designed artefact must be rigorously demonstrated.

The evaluation adopted an **artificial evaluation strategy**, in which the artefact is assessed against criteria specified in advance by the researcher under controlled, non-operational conditions (Hevner et al., 2004; March & Smith, 1995). This strategy was appropriate at the current stage of the research — design feasibility and governance-requirement coverage — rather than long-term operational performance under adversarial conditions. Two complementary evaluation frameworks were defined prior to any artefact assessment and applied independently.

**Framework 1 — Governance requirement coverage (R1–R6).** The six functional requirements derived from the normative doctrinal analysis were operationally defined as binary evaluation criteria before any artefact component was assessed. A requirement was considered satisfied if and only if: (i) the approach provides a named structural component whose specification addresses the corresponding governance deficit; and (ii) that component is instantiated in at least one demonstration scenario without requiring manual workarounds or implementation-specific substitutes. Requirements were assessed independently, and findings were recorded in tabular form mapping each governance deficit to its regulatory basis, the stated requirement, and the primary artefact component through which it is addressed (Table 4.1).

**Framework 2 — Structural completeness against the Pérez et al. (2018) taxonomy.** The approach was positioned against the six-dimensional provenance system taxonomy of Pérez, Rubio, and Sáenz-Adán (2018), derived from a systematic review of 105 studies covering 25 representative provenance systems. This taxonomy provides an independently derived, empirically grounded framework that allows the structural properties of the proposed approach to be assessed by reference to a standard in the broader provenance literature, rather than solely by criteria the approach itself was designed to satisfy. For each of the six dimensions — general aspects, data capture, data access, subject, storage, and non-functional requirements — the approach's design choices were documented and compared with the options and trade-offs described in the taxonomy.

**Test suite as objective quality evidence.** In keeping with Hevner et al.'s (2004) guideline that the quality of a DSR artefact must be demonstrated rigorously, the evaluation is supplemented by the results of the automated test suite maintained throughout development. The test suite comprises 1,099 passing tests distributed across all implementation packages (see Appendix A for a full breakdown). The tests exercise the EAA type validation logic, all four database adapters, all six file-storage adapters, the smart contract behaviour, all fifteen extensions, the privacy module, the indexer, the SDK, and the API integration. Continuous-integration results are reproducible and provide objective, implementation-level evidence of artefact quality that is independent of the author's evaluation judgements. The full test suite output is reported in Appendix A.

The limitations of this evaluation strategy are acknowledged in Section 3.4.

---

## 3.2.6 Communication

The outcomes of this research — the provenance approach design, the system implementation, and the evaluation results — are documented in this thesis. ProvenanceKit has been made publicly available as an open-source monorepo, with documentation at docs.provenancekit.com and a live operational demonstration at chat.provenancekit.com, in keeping with Hevner et al.'s (2004) guideline that design science research must be communicated to both technology-oriented and management-oriented audiences. The documentation covers the EAA model, the extension system, the API and SDK, UI components, and integration guides for representative Human-AI platforms. The chat application demonstrates the approach in a context accessible to non-technical stakeholders, surfacing provenance information through a badge and content provenance popover analogous to the C2PA Content Credentials display.

---

## 3.3 Methods

While DSRM provides the overarching research structure, three specific methods were employed to operationalise it: normative doctrinal analysis, examination of existing provenance systems, and structured artefact evaluation. Each is described below.

### 3.3.1 Normative Doctrinal Analysis

Normative doctrinal analysis was employed to examine the legal frameworks governing intellectual property and data governance as they relate to authorship, responsibility, and liability in the context of Human-AI-created works. The analysis was grounded in legislative and regulatory instruments and in the judicial interpretation of statutory provisions. Within the DSR framework, this method constitutes the primary mechanism through which the relevance cycle was instantiated, grounding the design requirements in the practical governance environment rather than in generic information-systems concerns.

The analysis was conducted across three jurisdictions selected because they collectively represent and inform prevailing international approaches to intellectual property, data governance, and artificial intelligence: the European Union, the United States, and the international treaty framework administered by the World Intellectual Property Organization. Within these jurisdictions, legal material was examined to determine the extent to which existing frameworks address four analytically distinct but interrelated concerns: the attribution of authorship to Human-AI outputs; the allocation of legal responsibility and liability for such outputs; the governance of personal and training data implicated in the creation process; and the conditions under which provenance records could serve as legally meaningful evidence. The output of this analysis was a set of governance deficits, translated into the six functional requirements (R1–R6) that structure both the artefact design and the evaluation.

The analysis was not intended as an exhaustive comparative survey of all jurisdictions. Its purpose within the DSR process was to derive a concrete, legally grounded set of requirements that a governance-oriented provenance approach must satisfy, enabling the design and evaluation stages to be anchored in normative obligations rather than in speculative or generic information-management concerns.

### 3.3.2 Examination of Existing Provenance Systems

A structured examination of existing systems exhibiting provenance-related or attribution-related functionality was conducted to ground the design process in the existing knowledge base, in keeping with the rigour cycle of DSR (Hevner et al., 2004). The objective was to identify the structural and technical properties that an interoperable provenance approach must possess and to understand where existing approaches fall short of the governance requirements derived in Section 3.3.1.

Systems were selected on the basis of three criteria: public accessibility through standard interfaces or documented application programming interfaces; the presence of at least one provenance-related or attribution-related feature evidenced by peer-reviewed literature or official technical documentation; and representativeness of the tool categories implicated in contemporary generative AI workflows. On this basis, the examination covered AI detection tools, watermarking systems (including SynthID, Google DeepMind, n.d.), content authenticity systems (C2PA specification, version 2.3), the W3C PROV data model (W3C, 2013a), and the representative scientific workflow provenance systems reviewed by Pérez et al. (2018) including VisTrails, Taverna, and Kepler.

For each system, the examination assessed three design dimensions: data capture granularity (what is recorded and at what level of detail); governance metadata coverage (whether the system captures actor-role distinctions, rights conditions, or authorisation information at the artefact level); and interoperability and privacy support. These dimensions correspond to the most weakly supported properties in existing systems identified by Pérez et al. (2018), and to the governance requirements derived from the legal analysis. The examination was conducted through direct interaction with publicly accessible interfaces and inspection of publicly available technical documentation. No system-internal data was accessed, and no user data was collected or analysed.

### 3.3.3 Artefact Evaluation

The evaluation of the proposed artefact was conducted as a structured, ex ante artificial evaluation, in which the artefact is assessed against criteria specified in advance under controlled conditions rather than through uncontrolled naturalistic deployment (Hevner et al., 2004; March & Smith, 1995). Three features of the evaluation method warrant explicit statement.

**Pre-specification of criteria.** The six governance requirements (R1–R6) were derived entirely from the normative doctrinal analysis in Section 3.3.1 and fixed prior to any implementation activity. A requirement was considered satisfied if and only if the approach provided a named, functional structural component addressing the corresponding governance deficit without requiring implementation-specific workarounds. This pre-specification ensures that the evaluation assesses the artefact against externally grounded requirements rather than criteria defined post hoc to fit the design.

**Independent reference framework.** The Pérez et al. (2018) taxonomy was applied as a second, independently derived evaluation framework. The taxonomy was not used to generate design requirements — it was applied only at the evaluation stage — allowing a cross-check of structural completeness that is independent of the governance-requirement framework. For each of the six taxonomy dimensions, the approach's design choices were documented against the options described in the taxonomy without foreknowledge of the evaluation verdict.

**Test suite as objective quality evidence.** Beyond the two analytical frameworks, the automated test suite provides objective, reproducible evidence of artefact quality independent of the author's judgements. The suite comprises 1,099 passing tests, distributed as follows: 27 smart contract tests (Foundry/Solidity), 93 storage tests covering all four database adapters and all six file-storage adapters, 66 indexer tests, 377 extension tests covering all fifteen ext:namespace@semver extensions, 43 payment adapter tests, 187 privacy module tests, 71 git-provenance tests, 157 media and C2PA tests, 47 SDK tests, and 31 API integration tests. All tests pass at the time of submission and are reproducible in a standard development environment. The full test output is provided in Appendix A, with instructions for independent reproduction. The test suite constitutes evidence of software quality and specification conformance rather than legal sufficiency; its role within the evaluation is to support Hevner et al.'s (2004) guideline on rigorous demonstration of artefact quality.

### 3.3.4 Data Collection

Legal materials were obtained from authoritative and publicly accessible legal databases and institutional repositories. European Union directives and regulations were accessed through EUR-Lex. International intellectual property treaties, policy documents, and guidance materials were sourced from the WIPO-Lex repository. United States federal case law and judicial materials were obtained from official court resources.

Secondary technical and scholarly literature was collected from established academic databases. Peer-reviewed research articles and conference proceedings were sourced from the IEEE Xplore digital library; additional literature was identified using Google Scholar. These sources were used to identify relevant work on data provenance, Human-AI collaboration, privacy-preserving systems, and emerging technical approaches to AI content governance.

Observations derived from direct examination of deployed systems, treated as primary research artefacts in the examination of existing provenance systems, constituted original data. No datasets were extracted from the examined systems, and no internal system data or user data were accessed at any stage.

### 3.3.5 Analysis

Analytical procedures were applied in a manner appropriate to each method. Findings from the normative doctrinal analysis and the examination of existing systems were qualitatively analysed independently and then synthesised to produce the governance requirements and design principles guiding artefact development. The evaluation in Chapter 4 applied both frameworks systematically and independently, with findings reported per requirement and per taxonomy dimension before a summary assessment was offered. The test results in Appendix A are reported as aggregated pass/fail counts per package, with the full detailed output available for independent verification.

---

## 3.4 Limitations

Several limitations apply to the methodology employed in this study.

**Legal scope.** The normative doctrinal analysis is limited to the European Union, the United States, and the WIPO framework. These jurisdictions are representative and influential, but the analysis does not provide a comprehensive comparative treatment of all intellectual property or data governance regimes. The legal environment in this area remains dynamic; future judicial decisions or regulatory guidance may shift the requirements that a governance-oriented provenance approach must satisfy, requiring revision of the requirements derivation in Section 4.2.

**Systems examination scope.** The examination of existing provenance systems is limited to observable behaviour and publicly available documentation. Internal architectures, proprietary mechanisms, and undisclosed implementation details could not be assessed, which may affect the completeness of conclusions regarding certain technical capabilities.

**Evaluation strategy.** The evaluation of the proposed artefact was conducted through an artificial evaluation strategy using scenario-based demonstrations and an automated test suite, rather than through independent deployment in operational environments. This choice is consistent with the scope of a design feasibility study at the prototype stage (Peffers et al., 2007–2008), but it means that the findings establish design feasibility and requirement coverage rather than long-term operational performance, adversarial robustness, or legal sufficiency in regulatory or litigation proceedings. No independent party deployed the approach against adversarial inputs. No legal practitioner reviewed whether the records produced would satisfy evidentiary standards in regulatory proceedings. No load testing was conducted at scale. These absences do not invalidate the findings, but they bound them: the correct characterisation of the evaluation result is that the approach satisfies the identified governance requirements at the level of design and functional prototype.

**Cooperative capture dependency.** Like all provenance systems, the approach depends on cooperative recording. Provenance that is not captured cannot be reconstructed. The approach records assertions made by actors and systems at the time of capture; tamper-evidence and non-repudiation can strengthen trust in recorded events but do not prevent incomplete or inaccurate metadata from being asserted in the first place. The records produced are therefore best understood as structured and probative evidence of claims made by identified actors at specific times, not as self-sufficient proof of underlying facts.

---

## References to Add to Bibliography

The following must be added to the list of references to address the supervisor's observation that a complete general reference to the DSR methodology is missing:

**Hevner, A. R., March, S. T., Park, J., & Ram, S. (2004).** Design science in information systems research. *MIS Quarterly*, *28*(1), 75–105. https://doi.org/10.2307/25148625

**Hevner, A. R. (2007).** A three cycle view of design science research. *Scandinavian Journal of Information Systems*, *19*(2), 87–92.

**March, S. T., & Smith, G. F. (1995).** Design and natural science research on information technology. *Decision Support Systems*, *15*(4), 251–266. https://doi.org/10.1016/0167-9236(94)00041-2

**Peffers, K., Tuunanen, T., Rothenberger, M. A., & Chatterjee, S. (2007–2008).** A design science research methodology for information systems research. *Journal of Management Information Systems*, *24*(3), 45–77. https://doi.org/10.2753/MIS0742-1222240302

*(Ensure the in-text citation reads consistently as "Peffers et al. (2007–2008)" throughout Chapter 3.)*

---

## Appendix A: Test Suite Summary (excerpt — reference for evaluation)

The following table summarises the automated test suite maintained throughout ProvenanceKit development. Full test output is available in Appendix A and reproducible by running `pnpm test` from the repository root.

| Package | Tests | Scope |
|---|---|---|
| @provenancekit/contracts | 27 | Smart contract behaviour (Foundry/Solidity): entity registration, resource registration, action recording, proof and commitment layer, hook dispatch |
| @provenancekit/storage | 93 | All four database adapters (in-memory, PostgreSQL, MongoDB, Supabase) and all six file-storage adapters (IPFS-Pinata, IPFS-Infura, IPFS-local, Web3.Storage, Arweave, memory) |
| @provenancekit/indexer | 66 | Event transformation functions (5 event types) and ProvenanceIndexer class: historical sync and real-time polling |
| @provenancekit/extensions | 377 | All 15 ext:namespace@semver extensions including ext:ai@1.0.0 (tool and agent modes), ext:license@1.0.0, ext:authorization@1.0.0, ext:contrib@1.0.0, and ext:x402@1.0.0 |
| @provenancekit/payments | 43 | Three payment adapters: Direct, 0xSplits, and Superfluid |
| @provenancekit/privacy | 187 | Five privacy modules: encryption-at-rest (XChaCha20-Poly1305), selective disclosure, Pedersen commitments, token-gated access control, encrypted vector search |
| @provenancekit/git | 71 | Git provenance recording and commit attribution |
| @provenancekit/media | 157 | C2PA integration, media provenance recording, and bidirectional bundle conversion |
| @provenancekit/sdk | 47 | IChainAdapter interface, createViemAdapter, createEIP1193Adapter, and the pk.file() integration path |
| provenancekit-api | 31 | API integration tests covering provenance recording, session management, bundle retrieval, rate limiting (sliding window, 429), and management routes |
| **Total** | **1,099** | **All tests passing** |
