include ../common.mk

all: build

dev:
	$(NPM) $@

dev-staging:
	$(NPM) dev -m staging

dev-production:
	$(NPM) dev -m production

dev-pontusxtest:
	$(NPM) dev -m pontusxtest

dev-lido:
	$(NPM) dev -m development.lido

build:
	$(NPM) $@

lint:
	$(NPM) $@

prettify:
	$(NPM) $@

build-staging:
	$(NPM) vite build -m staging

build-pontusxtest:
	$(NPM) vite build -m pontusxtest

build-production:
	$(NPM) vite build -m production

build-production-lido:
	$(NPM) vite build -m production.lido

clean:
	rm -rf dist

veryclean: clean
	rm -rf node_modules
