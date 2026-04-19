#!/usr/bin/env python3
"""
Security Audit Script for BuildShop
Performs comprehensive security checks on dependencies and configuration
"""

import subprocess
import sys
import json
from pathlib import Path
from typing import Tuple, List

class SecurityAudit:
    def __init__(self):
        self.project_root = Path(__file__).parent.parent
        self.server_dir = self.project_root / "server"
        self.client_dir = self.project_root / "client"
        self.issues = []
        self.warnings = []
        self.passed = []

    def run_all_checks(self) -> int:
        """Run all security checks"""
        print("🔒 BuildShop Security Audit Started\n")
        print("=" * 60)

        # Python security checks
        self._check_python_dependencies()
        self._check_python_config()

        # Node/NPM security checks
        self._check_npm_dependencies()

        # Configuration checks
        self._check_env_file()
        self._check_docker_security()

        # Print results
        self._print_results()

        return 1 if self.issues else (1 if self.warnings else 0)

    def _check_python_dependencies(self):
        """Check Python dependencies for known vulnerabilities"""
        print("\n📦 Checking Python Dependencies...")
        try:
            result = subprocess.run(
                ["pip", "audit", "--format", "json"],
                cwd=self.server_dir,
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                self.passed.append("✓ Python: No known vulnerabilities found")
            else:
                try:
                    data = json.loads(result.stdout)
                    vuln_count = len(data.get("vulnerabilities", []))
                    for vuln in data.get("vulnerabilities", []):
                        self.issues.append(
                            f"🔴 Python: {vuln['name']} - {vuln.get('description', 'See pip audit for details')}"
                        )
                except json.JSONDecodeError:
                    if "No known security vulnerabilities" in result.stdout:
                        self.passed.append("✓ Python: No known vulnerabilities found")
                    else:
                        self.warnings.append("⚠️  Python: Unable to parse pip audit output")
        except FileNotFoundError:
            self.warnings.append("⚠️  Python: pip-audit not installed. Run: pip install pip-audit")
        except subprocess.TimeoutExpired:
            self.warnings.append("⚠️  Python: pip-audit timed out")

    def _check_npm_dependencies(self):
        """Check NPM dependencies for known vulnerabilities"""
        print("📦 Checking NPM Dependencies...")
        try:
            result = subprocess.run(
                ["npm", "audit", "--json"],
                cwd=self.client_dir,
                capture_output=True,
                text=True,
                timeout=60
            )
            
            try:
                data = json.loads(result.stdout)
                vulnerabilities = data.get("vulnerabilities", {})
                
                if vulnerabilities:
                    critical = sum(1 for v in vulnerabilities.values() if v.get("severity") == "critical")
                    high = sum(1 for v in vulnerabilities.values() if v.get("severity") == "high")
                    
                    if critical > 0:
                        self.issues.append(f"🔴 NPM: {critical} CRITICAL vulnerabilities found")
                    elif high > 0:
                        self.warnings.append(f"⚠️  NPM: {high} HIGH vulnerabilities found")
                    else:
                        self.passed.append(f"✓ NPM: Vulnerabilities found but not critical")
                else:
                    self.passed.append("✓ NPM: No known vulnerabilities found")
            except json.JSONDecodeError:
                self.warnings.append("⚠️  NPM: Unable to parse npm audit output")
        except FileNotFoundError:
            self.warnings.append("⚠️  NPM: npm not installed")
        except subprocess.TimeoutExpired:
            self.warnings.append("⚠️  NPM: npm audit timed out")

    def _check_python_config(self):
        """Check Python configuration security"""
        print("\n⚙️  Checking Python Configuration...")
        
        config_file = self.server_dir / "config.py"
        if config_file.exists():
            content = config_file.read_text()
            
            # Check for hardcoded secrets
            if "dev-only-secret" not in content:
                self.passed.append("✓ Python: No dev secrets in code")
            else:
                self.warnings.append("⚠️  Python: Dev secret marker found (ensure production uses real SECRET_KEY)")
            
            # Check for password validation
            if "validate_password_strength" in content:
                self.passed.append("✓ Python: Password validation implemented")
            else:
                self.issues.append("🔴 Python: No password validation found")

    def _check_env_file(self):
        """Check environment file configuration"""
        print("\n🔐 Checking Environment Configuration...")
        
        env_file = self.project_root / ".env"
        env_example = self.project_root / ".env.example"
        
        if not env_file.exists():
            self.warnings.append("⚠️  .env file not found (OK for CI/CD)")
        else:
            content = env_file.read_text()
            
            # Check for dev values in production
            if "dev-only-secret-change-me" in content and "production" in content.lower():
                self.issues.append("🔴 ENV: Default SECRET_KEY found with ENVIRONMENT=production")
            
            if "ENVIRONMENT=production" in content:
                if "DEBUG=false" in content:
                    self.passed.append("✓ ENV: DEBUG is disabled in production")
                else:
                    self.issues.append("🔴 ENV: DEBUG is not disabled in production")
                
                if "CORS_ORIGINS=" in content and "http://localhost" not in content:
                    self.passed.append("✓ ENV: CORS origins configured for production")
                else:
                    self.warnings.append("⚠️  ENV: CORS origins may not be production-ready")
        
        if env_example.exists():
            self.passed.append("✓ ENV: .env.example documentation found")
        else:
            self.warnings.append("⚠️  ENV: .env.example not found (helpful for setup)")

    def _check_docker_security(self):
        """Check Docker configuration security"""
        print("\n🐳 Checking Docker Configuration...")
        
        server_dockerfile = self.server_dir / "Dockerfile"
        client_dockerfile = self.client_dir / "Dockerfile"
        
        issues_found = False
        
        # Check server Dockerfile
        if server_dockerfile.exists():
            content = server_dockerfile.read_text()
            
            if "FROM python:3.12-slim" in content:
                self.passed.append("✓ Docker (server): Using slim base image")
            else:
                self.warnings.append("⚠️  Docker (server): Consider using slim base image")
            
            if "USER" in content and "appuser" in content:
                self.passed.append("✓ Docker (server): Using non-root user")
            else:
                self.issues.append("🔴 Docker (server): Not using non-root user")
                issues_found = True
            
            if "HEALTHCHECK" in content:
                self.passed.append("✓ Docker (server): Health check configured")
            else:
                self.warnings.append("⚠️  Docker (server): No health check configured")
        
        # Check client Dockerfile
        if client_dockerfile.exists():
            content = client_dockerfile.read_text()
            
            if "node:22-alpine" in content:
                self.passed.append("✓ Docker (client): Using alpine base image")
            
            if "nginx:1.27-alpine" in content:
                self.passed.append("✓ Docker (client): Using alpine nginx")
            
            if "npm audit" in content:
                self.passed.append("✓ Docker (client): Running npm audit during build")
            else:
                self.warnings.append("⚠️  Docker (client): Consider running npm audit in Dockerfile")

    def _print_results(self):
        """Print audit results"""
        print("\n" + "=" * 60)
        print("\n📋 AUDIT RESULTS\n")
        
        if self.passed:
            print("✅ PASSED CHECKS:")
            for check in self.passed:
                print(f"  {check}")
        
        if self.warnings:
            print("\n⚠️  WARNINGS:")
            for warning in self.warnings:
                print(f"  {warning}")
        
        if self.issues:
            print("\n🔴 CRITICAL ISSUES:")
            for issue in self.issues:
                print(f"  {issue}")
        
        print("\n" + "=" * 60)
        print(f"\nSummary: {len(self.passed)} passed, {len(self.warnings)} warnings, {len(self.issues)} issues")
        
        if self.issues:
            print("\n⛔ AUDIT FAILED: Critical security issues found!")
            sys.exit(1)
        elif self.warnings:
            print("\n⚠️  AUDIT PASSED WITH WARNINGS")
            sys.exit(0)
        else:
            print("\n✅ AUDIT PASSED: All security checks passed!")
            sys.exit(0)

if __name__ == "__main__":
    audit = SecurityAudit()
    exit_code = audit.run_all_checks()
    sys.exit(exit_code)

