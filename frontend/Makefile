include ../common.mk

all: build

dev:
	$(NPM) $@

dev-staging:
	$(NPM) dev -m staging

dev-pontusxtest:
	$(NPM) dev -m pontusxtest

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

clean:
	rm -rf dist

veryclean: clean
	rm -rf node_modules

deploy-pontusxtest: build-pontusxtest
	./node_modules/.bin/netlify deploy --dir=frontend/dist --prod
