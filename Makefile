PY := backend/.venv/bin/python

.PHONY: setup train api web test serve

setup:
	python3 -m venv backend/.venv
	$(PY) -m pip install -r backend/requirements.txt
	cd frontend && npm install

train:
	cd backend && ../$(PY) -m creditlens.train

api:
	cd backend && ../$(PY) -m uvicorn creditlens.api:app --reload --port 8765

web:
	cd frontend && npm run dev

test:
	cd backend && ../$(PY) -m pytest -q tests
	cd frontend && npm test

serve:
	cd frontend && npm run build
	cd backend && ../$(PY) -m uvicorn creditlens.api:app --port 8765
