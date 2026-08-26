# ProvenanceKit AWS production

ProvenanceKit production runs in `eu-west-1` on Amazon ECS Express Mode. The
service uses three warm tasks across multiple Availability Zones, scales on CPU,
and is fronted by the managed Express load balancer and TLS endpoint. Images are
immutable, scanned on push in ECR, and retained for rollback.

The internet-facing Express ingress uses custom public subnets. Task ingress is
restricted to the managed load balancer/VPC security path; PostgreSQL remains in
separate private subnets and only accepts connections from the task/build SG.

Runtime secrets live in AWS Secrets Manager and are injected by individual JSON
key. GitHub Actions obtains short-lived AWS credentials through OIDC; no AWS
access keys are stored in GitHub. CodeBuild runs tests/builds, applies ordered
PostgreSQL migrations before deploy, creates an immutable image, deploys via
CloudFormation, and performs authenticated persistence smoke tests.

Production refuses to start when PostgreSQL or object storage is absent. The
default AWS deployment uses private, encrypted, Multi-AZ RDS PostgreSQL with
35-day point-in-time recovery and a private, encrypted, versioned S3 bucket.
On-chain anchoring remains an explicit request-level option; normal ingestion is
off-chain and does not incur a transaction.

## Bootstrap

```bash
aws cloudformation deploy \
  --stack-name provenancekit-api-bootstrap \
  --template-file infra/aws/bootstrap.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --region eu-west-1
```

Import the existing production configuration without printing values:

```bash
AWS_REGION=eu-west-1 infra/aws/import-runtime-secrets.sh \
  apps/provenancekit-api/.env provenancekit/api/production
```

Set the `Production` GitHub environment variables from the bootstrap outputs:

- `AWS_DEPLOY_ROLE_ARN`
- `AWS_REGION`
- `AWS_SOURCE_BUCKET`
- `AWS_CODEBUILD_PROJECT`

## Cutover and rollback

1. Deploy and verify the AWS service endpoint directly.
2. Lower `api.provenancekit.com` DNS TTL, then replace its old Google CNAME with
   the approved AWS custom-domain target.
3. Verify health, authentication, batch persistence, media/IPFS retrieval,
   attribution reads, and Agent Commons staging export.
4. Keep the old GCP mapping untouched during the observation window. The old
   Cloud Run service is already absent, so rollback uses the previous immutable
   ECR image or CloudFormation service revision—not GCP.

The former Supabase project and GCP Cloud Run service were already unavailable,
so there was no reachable production dataset to copy. The Pinata and Supabase
adapters remain supported plugins, while the production defaults are AWS-native.
