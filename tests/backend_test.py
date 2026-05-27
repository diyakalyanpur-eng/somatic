"""
AiSteth Phase 5 Backend Regression Tests
Light pass to verify core API endpoints still work.
"""

import requests
import sys
from datetime import datetime

BASE_URL = "https://rpulse-demo.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.failures = []

    def test(self, name, method, endpoint, expected_status=200, data=None, check_fn=None):
        """Run a single API test"""
        url = f"{BASE_URL}{endpoint}"
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            if success and check_fn:
                try:
                    check_fn(response.json())
                except Exception as e:
                    success = False
                    print(f"❌ Failed - Check function error: {e}")
                    self.failures.append(f"{name}: {e}")

            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                self.failures.append(f"{name}: HTTP {response.status_code}")
                if response.status_code != expected_status:
                    try:
                        print(f"   Response: {response.text[:200]}")
                    except:
                        pass

            return success, response.json() if success else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failures.append(f"{name}: {str(e)}")
            return False, {}

    def run_all(self):
        print("=" * 60)
        print("AiSteth Phase 5 Backend Regression Tests")
        print("=" * 60)

        # Test 1: Root endpoint - version check
        self.test(
            "GET /api/ - version 1.1.0",
            "GET",
            "/",
            check_fn=lambda r: self._check_version(r)
        )

        # Test 2: Stats endpoint
        self.test(
            "GET /api/stats",
            "GET",
            "/stats",
            check_fn=lambda r: self._check_stats(r)
        )

        # Test 3: Patients list
        self.test(
            "GET /api/patients",
            "GET",
            "/patients",
            check_fn=lambda r: self._check_patients(r)
        )

        # Test 4: Save assessment
        assessment_data = {
            "profile": {
                "age": 52,
                "sex": "male",
                "ethnicity": "indian",
                "bmi": 25.9,
                "heightCm": 178,
                "weightKg": 82,
                "sbp": 142,
                "cholHdl": 5.0,
                "smoking": "ex",
                "type2Dm": True,
                "treatedHtn": True
            },
            "vitals": {
                "hr": 72,
                "hrv_ms": 42,
                "spo2": 98,
                "brpm": 14
            },
            "qrisk3Score": 15.3,
            "recommendations": [
                {"priority": "soon", "area": "Blood test", "test": "Fasting lipid panel", "reason": "Test reason"}
            ]
        }
        success, response = self.test(
            "POST /api/save-assessment",
            "POST",
            "/save-assessment",
            data=assessment_data,
            check_fn=lambda r: self._check_save_response(r)
        )

        # Test 5: Narrative generation (with cache)
        narrative_data = {
            "profile": {
                "age": 52,
                "sex": "male",
                "ethnicity": "indian",
                "bmi": 25.9,
                "sbp": 142,
                "cholHdl": 5.0,
                "smoking": "ex"
            },
            "vitals": {
                "hr": 72,
                "hrv_ms": 42,
                "spo2": 98,
                "brpm": 14
            },
            "qrisk3Score": 15.3,
            "recommendations": [
                {"priority": "soon", "area": "Blood test", "test": "Fasting lipid panel", "reason": "Test reason"}
            ]
        }
        self.test(
            "POST /api/narrative (Mistral AI)",
            "POST",
            "/narrative",
            data=narrative_data,
            check_fn=lambda r: self._check_narrative(r)
        )

        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Tests passed: {self.tests_passed}/{self.tests_run}")
        if self.failures:
            print("\n❌ Failures:")
            for f in self.failures:
                print(f"  - {f}")
        print("=" * 60)
        
        return 0 if self.tests_passed == self.tests_run else 1

    def _check_version(self, response):
        assert response.get("version") == "1.1.0", f"Expected version 1.1.0, got {response.get('version')}"
        assert response.get("service") == "aisteth", "Service name mismatch"

    def _check_stats(self, response):
        assert "totalScans" in response, "Missing totalScans"
        assert "totalAssessments" in response, "Missing totalAssessments"
        assert "totalPatients" in response, "Missing totalPatients"

    def _check_patients(self, response):
        assert "rows" in response, "Missing rows"
        assert isinstance(response["rows"], list), "rows should be a list"

    def _check_save_response(self, response):
        assert response.get("ok") is True, "ok should be True"
        assert "id" in response, "Missing id in response"

    def _check_narrative(self, response):
        assert response.get("ok") is True, "ok should be True"
        assert "text" in response, "Missing text in response"
        text = response.get("text", "")
        assert len(text) > 50, f"Narrative text too short: {len(text)} chars"
        print(f"   ✓ Narrative length: {len(text)} chars")
        print(f"   ✓ Cached: {response.get('cached', False)}")

def main():
    tester = BackendTester()
    return tester.run_all()

if __name__ == "__main__":
    sys.exit(main())
