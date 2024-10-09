.PHONY: init build apply destroy

# Build Lambda functions with esbuild
build:
	@echo "Building Lambda functions..."
	cd backend && npm run build

init:
	@echo "Initializing Terraform configuration..."
	cd infra && terraform init

validate:
	@echo "Validating Terraform configuration..."
	cd infra && terraform validate

# Initialize Terraform and apply configuration
apply: build
	@echo "Applying Terraform configuration..."
	cd infra && terraform apply

# Destroy Terraform-managed infrastructure
destroy:
	@echo "Destroying Terraform-managed infrastructure..."
	cd infra && terraform destroy
