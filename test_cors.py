#!/usr/bin/env python3
"""
CORS Configuration Tester
Tests if the API backend is properly configured for CORS with the frontend.
"""

import requests
import json
import sys
from urllib.parse import urlparse

def test_cors(api_url, frontend_origin):
    """Test if API server returns proper CORS headers"""
    print(f"\n{'='*70}")
    print(f"CORS Configuration Tester")
    print(f"{'='*70}\n")

    print(f"Backend API: {api_url}")
    print(f"Frontend Origin: {frontend_origin}\n")

    # Test 1: Preflight request (OPTIONS)
    print(f"Test 1: Preflight Request (OPTIONS)")
    print(f"{'-'*70}")

    try:
        response = requests.options(
            f"{api_url}/api/stats",
            headers={
                'Origin': frontend_origin,
                'Access-Control-Request-Method': 'GET',
                'Access-Control-Request-Headers': 'Content-Type',
            }
        )

        print(f"Status Code: {response.status_code}")

        cors_headers = {
            'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin', 'NOT SET'),
            'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods', 'NOT SET'),
            'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers', 'NOT SET'),
            'Access-Control-Allow-Credentials': response.headers.get('Access-Control-Allow-Credentials', 'NOT SET'),
            'Access-Control-Max-Age': response.headers.get('Access-Control-Max-Age', 'NOT SET'),
        }

        print("\nCORS Response Headers:")
        for header, value in cors_headers.items():
            status = "✓" if value != "NOT SET" else "✗"
            print(f"  {status} {header}: {value}")

        if response.status_code == 200 and cors_headers['Access-Control-Allow-Origin'] == frontend_origin:
            print(f"\n✓ Preflight request successful!")
        else:
            print(f"\n✗ Preflight request failed or missing CORS headers!")

    except Exception as e:
        print(f"✗ Error during preflight test: {e}")
        return False

    # Test 2: Actual request
    print(f"\n\nTest 2: Actual GET Request")
    print(f"{'-'*70}")

    try:
        response = requests.get(
            f"{api_url}/api/stats",
            headers={
                'Origin': frontend_origin,
            }
        )

        print(f"Status Code: {response.status_code}")

        cors_origin = response.headers.get('Access-Control-Allow-Origin', 'NOT SET')
        print(f"Access-Control-Allow-Origin: {cors_origin}")

        if response.status_code == 200:
            print(f"Response Body: {response.json()}")
            print(f"\n✓ GET request successful!")
        else:
            print(f"Response: {response.text[:200]}")
            print(f"\n✗ GET request failed with status {response.status_code}")

    except requests.exceptions.ConnectionError as e:
        print(f"✗ Connection error: {e}")
        print(f"  Make sure the API server is running at {api_url}")
        return False
    except Exception as e:
        print(f"✗ Error during GET test: {e}")
        return False

    print(f"\n{'='*70}")
    print(f"Checklist:")
    print(f"{'='*70}")
    print(f"✓ Backend returns CORS headers")
    print(f"✓ Origin header matches allowed origins in backend config")
    print(f"✓ Credentials are allowed if needed")
    print(f"\nNext steps:")
    print(f"1. Verify CORS_ORIGINS environment variable on Render includes your frontend")
    print(f"2. Verify VITE_API_BASE_URL environment variable is set on Vercel")
    print(f"3. Check backend logs for any errors")
    print(f"4) Restart both frontend and backend after changing environment variables")

    return True

if __name__ == '__main__':
    # Local testing
    api_url = 'http://localhost:8001'
    frontend_origin = 'http://localhost:5173'  # Default Vite dev server

    if len(sys.argv) > 1:
        api_url = sys.argv[1]
    if len(sys.argv) > 2:
        frontend_origin = sys.argv[2]

    test_cors(api_url, frontend_origin)

