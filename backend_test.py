"""
Somatic Wellness App - Backend API Test Suite
Tests all wellness endpoints with Louise Hay-inspired language validation
"""

import requests
import sys
import time
from datetime import datetime

# Use public endpoint from frontend/.env
BASE_URL = "https://rpulse-demo.preview.emergentagent.com/api"

class SomaticAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.tests_run = 0
        self.tests_passed = 0
        self.snapshot_id = None
        self.journal_id = None
        
    def log(self, msg, status="INFO"):
        print(f"[{status}] {msg}")
    
    def test(self, name, method, endpoint, expected_status=200, data=None, validate_fn=None):
        """Run a single API test with optional validation"""
        url = f"{self.base_url}{endpoint}"
        self.tests_run += 1
        self.log(f"Testing {name}...", "TEST")
        
        try:
            if method == "GET":
                response = requests.get(url, timeout=30)
            elif method == "POST":
                response = requests.post(url, json=data, timeout=30)
            else:
                self.log(f"Unsupported method {method}", "ERROR")
                return False, {}
            
            # Check status code
            if response.status_code != expected_status:
                self.log(f"FAILED - Expected {expected_status}, got {response.status_code}", "FAIL")
                self.log(f"Response: {response.text[:200]}", "DEBUG")
                return False, {}
            
            # Parse JSON
            try:
                result = response.json()
            except:
                self.log(f"FAILED - Invalid JSON response", "FAIL")
                return False, {}
            
            # Run custom validation if provided
            if validate_fn:
                validation_result = validate_fn(result)
                if not validation_result:
                    self.log(f"FAILED - Validation failed", "FAIL")
                    return False, result
            
            self.tests_passed += 1
            self.log(f"PASSED ✓", "PASS")
            return True, result
            
        except requests.exceptions.Timeout:
            self.log(f"FAILED - Request timeout", "FAIL")
            return False, {}
        except Exception as e:
            self.log(f"FAILED - {str(e)}", "FAIL")
            return False, {}
    
    def validate_louise_hay_language(self, text):
        """Validate that text uses wellness language, not clinical"""
        if not text:
            return False
        
        # Clinical terms that should NOT appear
        clinical_terms = [
            "diagnosis", "diagnostic", "disease", "disorder", "pathology",
            "medical condition", "treatment", "medication", "prescription",
            "patient", "clinical", "syndrome"
        ]
        
        text_lower = text.lower()
        for term in clinical_terms:
            if term in text_lower:
                self.log(f"Found clinical term '{term}' in text: {text[:100]}", "WARN")
                return False
        
        # Wellness terms that SHOULD appear
        wellness_terms = [
            "body", "heart", "breath", "feel", "emotion", "nervous system",
            "invitation", "pause", "gentle", "compassion", "acceptance"
        ]
        
        has_wellness = any(term in text_lower for term in wellness_terms)
        if not has_wellness:
            self.log(f"No wellness language found in: {text[:100]}", "WARN")
        
        return True
    
    def run_all_tests(self):
        """Run complete test suite"""
        self.log("=" * 60, "INFO")
        self.log("SOMATIC WELLNESS APP - BACKEND TEST SUITE", "INFO")
        self.log("=" * 60, "INFO")
        
        # Test 1: Health check
        self.log("\n--- Basic Health Checks ---", "INFO")
        self.test("API Root", "GET", "/")
        self.test("Stats Endpoint", "GET", "/stats")
        
        # Test 2: Affirmations
        self.log("\n--- Affirmations & Daily Content ---", "INFO")
        success, data = self.test(
            "Get Today's Affirmation",
            "GET",
            "/affirmations/today",
            validate_fn=lambda d: (
                d.get("ok") and 
                d.get("affirmation") and 
                d.get("mirror") and 
                d.get("journal")
            )
        )
        if success:
            self.log(f"  Affirmation: {data.get('affirmation', {}).get('text', '')[:60]}...", "INFO")
            self.log(f"  Mirror: {data.get('mirror', '')[:60]}...", "INFO")
            self.log(f"  Journal: {data.get('journal', '')[:60]}...", "INFO")
        
        # Test 3: Snapshot creation (new Somatic payload)
        self.log("\n--- Snapshot Creation ---", "INFO")
        snapshot_payload = {
            "mode": "face",
            "deviceType": "desktop",
            "durationSec": 30,
            "fused": {
                "bpm": 68,
                "hrv_ms": 45,
                "spo2": 98,
                "brpm": 14,
                "quality": 0.85
            },
            "face": {
                "result": {
                    "hr": 68,
                    "hrv_ms": 45,
                    "confidence": 0.85
                }
            },
            "finger": None
        }
        
        success, data = self.test(
            "Create Snapshot (Somatic payload)",
            "POST",
            "/snapshot",
            data=snapshot_payload,
            validate_fn=lambda d: d.get("ok") and d.get("id")
        )
        
        if success:
            self.snapshot_id = data.get("id")
            self.log(f"  Snapshot ID: {self.snapshot_id}", "INFO")
        
        # Test 4: Retrieve snapshot
        if self.snapshot_id:
            self.log("\n--- Snapshot Retrieval ---", "INFO")
            success, data = self.test(
                "Get Snapshot by ID",
                "GET",
                f"/snapshots/{self.snapshot_id}",
                validate_fn=lambda d: (
                    d.get("ok") and 
                    d.get("row") and 
                    d.get("row", {}).get("fused") and
                    d.get("row", {}).get("fused", {}).get("bpm") == 68 and
                    d.get("row", {}).get("fused", {}).get("hrv_ms") == 45
                )
            )
            if success:
                fused = data.get("row", {}).get("fused", {})
                self.log(f"  BPM: {fused.get('bpm')}, HRV: {fused.get('hrv_ms')} ms", "INFO")
        
        # Test 5: Insight generation (Louise Hay-inspired)
        self.log("\n--- AI Insight Generation (Louise Hay-inspired) ---", "INFO")
        insight_payload = {
            "snapshotId": self.snapshot_id,
            "nervousSystemStateKey": "mild",
            "vitals": {
                "bpm": 68,
                "hrv_ms": 45
            },
            "context": {
                "practiceIntent": "reflection"
            }
        }
        
        success, data = self.test(
            "Generate Insight (First call)",
            "POST",
            "/insight",
            data=insight_payload,
            validate_fn=lambda d: (
                d.get("ok") and 
                d.get("text") and
                len(d.get("text", "")) > 50
            )
        )
        
        if success:
            insight_text = data.get("text", "")
            self.log(f"  Insight text: {insight_text[:150]}...", "INFO")
            self.log(f"  Cached: {data.get('cached', False)}", "INFO")
            
            # Validate Louise Hay language
            if self.validate_louise_hay_language(insight_text):
                self.log("  ✓ Uses wellness language (not clinical)", "PASS")
            else:
                self.log("  ✗ Contains clinical language (should be wellness-focused)", "FAIL")
            
            # Test caching - second call should return cached:true
            self.log("\n  Testing insight caching...", "INFO")
            time.sleep(1)
            success2, data2 = self.test(
                "Generate Insight (Second call - should be cached)",
                "POST",
                "/insight",
                data=insight_payload,
                validate_fn=lambda d: d.get("cached") == True
            )
            if success2:
                self.log(f"  ✓ Cache working correctly", "PASS")
        
        # Test 6: Journal entry
        self.log("\n--- Journal Entry ---", "INFO")
        journal_payload = {
            "text": "Today I felt a gentle shift in my awareness. My body is teaching me to slow down.",
            "prompt": "What emotion have you been carrying today?",
            "snapshotId": self.snapshot_id
        }
        
        success, data = self.test(
            "Create Journal Entry",
            "POST",
            "/journal",
            data=journal_payload,
            validate_fn=lambda d: d.get("ok") and d.get("row") and d.get("row", {}).get("id")
        )
        
        if success:
            self.journal_id = data.get("row", {}).get("id")
            self.log(f"  Journal ID: {self.journal_id}", "INFO")
        
        # Test 7: Practice logging
        self.log("\n--- Practice Logging ---", "INFO")
        practice_types = ["affirmation", "journal", "breath", "scan", "reflection"]
        
        for practice_type in practice_types:
            self.test(
                f"Log Practice ({practice_type})",
                "POST",
                "/practice",
                data={"kind": practice_type, "snapshotId": self.snapshot_id}
            )
        
        # Test 8: Streak calculation
        self.log("\n--- Streak Calculation ---", "INFO")
        success, data = self.test(
            "Get Current Streak",
            "GET",
            "/streak",
            validate_fn=lambda d: (
                d.get("ok") and 
                "streak" in d and
                "totalDays" in d
            )
        )
        
        if success:
            self.log(f"  Current streak: {data.get('streak')} days", "INFO")
            self.log(f"  Total practice days: {data.get('totalDays')}", "INFO")
        
        # Test 9: Notify-me (feature interest)
        self.log("\n--- Feature Interest Signup ---", "INFO")
        notify_payload = {
            "feature": "auscultation",
            "email": f"test_{int(time.time())}@example.com"
        }
        
        self.test(
            "Notify Me Signup",
            "POST",
            "/notify-me",
            data=notify_payload
        )
        
        # Test 10: List snapshots
        self.log("\n--- List Snapshots ---", "INFO")
        success, data = self.test(
            "List Recent Snapshots",
            "GET",
            "/snapshots?limit=5",
            validate_fn=lambda d: d.get("ok") and "rows" in d
        )
        
        if success:
            self.log(f"  Total snapshots: {data.get('total', 0)}", "INFO")
            self.log(f"  Returned: {len(data.get('rows', []))} rows", "INFO")
        
        # Test 11: List journal entries
        self.log("\n--- List Journal Entries ---", "INFO")
        success, data = self.test(
            "List Journal Entries",
            "GET",
            "/journal",
            validate_fn=lambda d: d.get("ok") and "rows" in d
        )
        
        if success:
            self.log(f"  Total entries: {len(data.get('rows', []))}", "INFO")
        
        # Final summary
        self.log("\n" + "=" * 60, "INFO")
        self.log("TEST SUMMARY", "INFO")
        self.log("=" * 60, "INFO")
        self.log(f"Tests Run: {self.tests_run}", "INFO")
        self.log(f"Tests Passed: {self.tests_passed}", "INFO")
        self.log(f"Tests Failed: {self.tests_run - self.tests_passed}", "INFO")
        self.log(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%", "INFO")
        
        return self.tests_passed == self.tests_run

def main():
    tester = SomaticAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
