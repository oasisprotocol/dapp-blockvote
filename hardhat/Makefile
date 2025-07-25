include ../common.mk

.PHONY: build
build:
	$(NPM) hardhat compile --force --quiet
	$(NPM) build

.PHONY: deploy-localnet
deploy-localnet:
	$(NPM) hardhat --network sapphire-localnet deploy --viteenv ../frontend/.env.development.local
	$(NPM) hardhat --network sapphire-localnet deploy-minime-acl --viteenv ../frontend/.env.development.local

.PHONY: test-localnet
test-localnet:
	$(NPM) hardhat --network sapphire-localnet test

.PHONY: deploy-testnet
deploy-testnet:
	$(NPM) hardhat --network sapphire-testnet deploy --viteenv ../frontend/.env.staging
	$(NPM) hardhat --network sapphire-testnet deploy-minime-acl --viteenv ../frontend/.env.staging

.PHONY: deploy-mainnet
deploy-mainnet:
	$(NPM) hardhat --network sapphire deploy --viteenv ../frontend/.env.production
	$(NPM) hardhat --network sapphire deploy-minime-acl --viteenv ../frontend/.env.production

.PHONY: deploy-pontusx-testnet
deploy-pontusx-testnet:
	$(NPM) hardhat --network pontusx-testnet deploy --viteenv ../frontend/.env.production.pontusx
	$(NPM) hardhat --network pontusx-testnet deploy-minime-acl --viteenv ../frontend/.env.production.pontusx

.PHONY: test
test:
	$(NPM) test

.PHONY: clean
clean:
	rm -rf lib src/contracts abis artifacts cache

.PHONY: veryclean
veryclean:
	rm -rf node_modules
