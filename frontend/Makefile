include ../common.mk

all: build

dev:
	$(NPM) $@

dev-staging:
	$(NPM) dev -m staging

dev-production:
	$(NPM) dev -m production

dev-pontusx:
	$(NPM) dev -m development.pontusx

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

build-production:
	$(NPM) vite build -m production

build-production-lido:
	$(NPM) vite build -m production.lido

build-pontusx:
	$(NPM) vite build -m production.pontusx

clean:
	rm -rf dist

veryclean: clean
	rm -rf node_modules
