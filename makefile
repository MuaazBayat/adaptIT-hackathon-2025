actions-test-frontend-ci:
	act -W '.github/workflows/frontend-ci.yml' --secret-file repo.secrets --container-architecture=linux/amd64
