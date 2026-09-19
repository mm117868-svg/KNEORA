# KNEORA: the patient app at the root, the depth bench in depth-bench/.
# `make` or `make help` lists the targets.

PORT ?= 8000

.PHONY: help test test-app test-depth serve fixture

help:
	@echo "make test        every check: the app (Node) and the depth bench (Python)"
	@echo "make test-app    the patient app and the recorded-exercise analyser"
	@echo "make test-depth  the depth bench geometry and its contract with the app"
	@echo "make serve       the patient app on http://localhost:$(PORT) (the camera needs localhost or https)"
	@echo "make fixture     write the shared depth export fixture again after an intended format change"

test: test-app test-depth

test-app:
	node --test tests/*.test.mjs video-analysis/*.test.mjs

test-depth:
	cd depth-bench && python3 -m unittest discover -s tests

serve:
	python3 -m http.server $(PORT)

fixture:
	python3 depth-bench/tests/contract_fixture.py --write
