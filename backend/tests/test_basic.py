"""
Basic tests for AEON Platform
"""
import pytest
from fastapi.testclient import TestClient
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

client = TestClient(app)


def test_root_endpoint():
    """Test root endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    assert "status" in response.json()


def test_health_check():
    """Test health check endpoint"""
    response = client.get("/orchestrator/heartbeat")
    assert response.status_code == 200


def test_api_documentation():
    """Test API documentation is available"""
    response = client.get("/docs")
    assert response.status_code == 200


def test_performance_health():
    """Test performance health endpoint"""
    response = client.get("/performance/health")
    assert response.status_code == 200


def test_security_health():
    """Test security health endpoint"""
    response = client.get("/security/health")
    assert response.status_code == 200


# More comprehensive tests would go here:
# - Authentication tests
# - CRUD operation tests
# - Integration tests
# - Security tests
# - Performance tests
