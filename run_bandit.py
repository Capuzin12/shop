#!/usr/bin/env python3
"""Run bandit security scan."""
import subprocess
import sys
import os

os.chdir('server')
result = subprocess.run(
    [sys.executable, '-m', 'bandit', '-q', '-r', '.', '-x', 'tests,alembic'],
    capture_output=False
)
sys.exit(result.returncode)

