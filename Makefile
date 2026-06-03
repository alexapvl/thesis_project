.PHONY: frontend backend-mac tunnel

# Override: make tunnel WIN_SSH=apava@192.168.1.13
WIN_SSH ?= Desktop_LAN

frontend:
	pnpm --filter web dev

backend-mac:
	cd services/inference && STL_DEVICE=mps conda run -n uni --no-capture-output python run_dev.py

tunnel:
	ssh -N -L 8000:localhost:8000 $(WIN_SSH)
