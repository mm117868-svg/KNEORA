# KNEORA: the patient app. `make` or `make help` lists the targets.

PORT ?= 8000

.PHONY: help test serve

help:
	@echo "make test   the patient app and the recorded-exercise analyser (Node)"
	@echo "make serve  the patient app on http://localhost:$(PORT) (the camera needs localhost or https)"

test:
	node --test tests/*.test.mjs video-analysis/*.test.mjs

serve:
	python3 -m http.server $(PORT)
