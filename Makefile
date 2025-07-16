build: node_modules
	$(MAKE) -C hardhat $@
	$(MAKE) -C contracts $@
	$(MAKE) -C frontend $@

build-staging: node_modules
	$(MAKE) -C hardhat build
	$(MAKE) -C contracts build
	$(MAKE) -C frontend build-staging

build-production: node_modules
	$(MAKE) -C hardhat build
	$(MAKE) -C contracts build
	$(MAKE) -C frontend build-production

build-production-lido: node_modules
	$(MAKE) -C hardhat build
	$(MAKE) -C contracts build
	$(MAKE) -C frontend build-production-lido

clean:
	$(MAKE) -C hardhat $@
	$(MAKE) -C contracts $@
	$(MAKE) -C frontend $@

deploy: build
	$(MAKE) -C hardhat deploy-testnet
	$(MAKE) -C frontend $@

node_modules: $(wildcard */package.json)
	pnpm install

veryclean: clean
	$(MAKE) -C hardhat $@
	$(MAKE) -C contracts $@
	$(MAKE) -C frontend $@
	rm -rf node_modules pnpm-lock.yaml
