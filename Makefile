.PHONY: frontend backend

frontend:
	pnpm --filter web dev

backend:
	conda run -n uni pnpm dev:server
