@echo off
set STL_DEVICE=cuda
cd /d %~dp0
conda run -n uni --no-capture-output python run_dev.py
