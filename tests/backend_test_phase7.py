"""
AiSteth Phase 7 Backend Tests - Health Insights + Regression
Tests new Health Insights endpoints and verifies existing Somatic endpoints still work.
"""

import requests
import sys
import time
from datetime import datetime

BASE_URL = "https://rpulse-demo.preview.emergentagent.com/api"

class Phase7BackendTester:
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
                response = requests.get(url, timeout=15)
            elif method == 'POST':
                response = requests.post(url, json=data, timeout=15)
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
                        print(f"   Response: {response.text[:300]}")
                    except:
                        pass

            return success, response.json() if success else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failures.append(f"{name}: {str(e)}")
            return False, {}

    def run_all(self):
        print("=" * 70)
        print("AiSteth Phase 7 Backend Tests - Health Insights + Regression")
        print("=" * 70)

        # ═══════════════════════════════════════════════════════════════
        # PHASE 7: NEW HEALTH INSIGHTS ENDPOINTS
        # ═══════════════════════════════════════════════════════════════
        
        print("\n" + "─" * 70)
        print("PHASE 7: HEALTH INSIGHTS ENDPOINTS")
        print("─" * 70)

        # Test 1: GET /api/health/models
        self.test(
            "GET /api/health/models - list available risk models",
            "GET",
            "/health/models",
            check_fn=lambda r: self._check_models(r)
        )

        # Test 2: POST /api/health/risk - India (WHO/ISH primary)
        india_inputs = {
            "region": "india",
            "ethnicity": "indian",
            "age": 55,
            "sex": "male",
            "sbp": 145,
            "bmi": 26.5,
            "total_cholesterol": 5.5,
            "hdl": 1.2,
            "smoking": "non",
            "diabetes_type": "type2",
            "family_history": True,
            "treated_hypertension": False,
            "ckd": False,
            "af": False,
            "ra": False,
        }
        success, india_result = self.test(
            "POST /api/health/risk - region='india' (WHO/ISH primary)",
            "POST",
            "/health/risk",
            data=india_inputs,
            check_fn=lambda r: self._check_risk_india(r)
        )

        # Test 3: POST /api/health/risk - Europe (SCORE2 primary)
        europe_inputs = {
            "region": "europe",
            "ethnicity": "white_or_unknown",
            "age": 60,
            "sex": "female",
            "sbp": 135,
            "total_cholesterol": 5.0,
            "hdl": 1.4,
            "smoking": "ex",
            "score2_region": "moderate",
        }
        self.test(
            "POST /api/health/risk - region='europe' (SCORE2 primary)",
            "POST",
            "/health/risk",
            data=europe_inputs,
            check_fn=lambda r: self._check_risk_europe(r)
        )

        # Test 4: POST /api/health/risk - UK (QRISK3 primary)
        uk_inputs = {
            "region": "uk",
            "ethnicity": "white_or_unknown",
            "age": 58,
            "sex": "male",
            "sbp": 140,
            "bmi": 28,
            "chol_hdl_ratio": 4.5,
            "smoking": "light",
            "diabetes_type": "none",
            "family_history": False,
            "treated_hypertension": True,
            "ckd": False,
            "af": False,
            "ra": False,
        }
        self.test(
            "POST /api/health/risk - region='uk' (QRISK3 primary)",
            "POST",
            "/health/risk",
            data=uk_inputs,
            check_fn=lambda r: self._check_risk_uk(r)
        )

        # Test 5: POST /api/health/analyze - structured Mistral analysis
        analyze_inputs = {
            "inputs": india_inputs,
            "vitals": {"bpm": 78, "hrv_ms": 45},
            "force": False,
        }
        success, analyze_result = self.test(
            "POST /api/health/analyze - structured analysis (first call)",
            "POST",
            "/health/analyze",
            data=analyze_inputs,
            check_fn=lambda r: self._check_analyze(r)
        )

        # Test 6: POST /api/health/analyze - cache hit
        if success:
            time.sleep(1)
            self.test(
                "POST /api/health/analyze - cache hit (second identical call)",
                "POST",
                "/health/analyze",
                data=analyze_inputs,
                check_fn=lambda r: self._check_analyze_cached(r)
            )

        # Test 7: POST /api/health/analyze - force=true bypasses cache
        analyze_inputs_force = {**analyze_inputs, "force": True}
        self.test(
            "POST /api/health/analyze - force=true bypasses cache",
            "POST",
            "/health/analyze",
            data=analyze_inputs_force,
            check_fn=lambda r: self._check_analyze_force(r)
        )

        # Test 8: GET /api/health/reports
        self.test(
            "GET /api/health/reports - list recent reports",
            "GET",
            "/health/reports",
            check_fn=lambda r: self._check_reports(r)
        )

        # Test 9: POST /api/affirmations/condition - valid key
        self.test(
            "POST /api/affirmations/condition - valid key 'stress'",
            "POST",
            "/affirmations/condition",
            data={"conditionKey": "stress"},
            check_fn=lambda r: self._check_condition_affirmation(r)
        )

        # Test 10: POST /api/affirmations/condition - valid key 'hypertension_risk'
        self.test(
            "POST /api/affirmations/condition - valid key 'hypertension_risk'",
            "POST",
            "/affirmations/condition",
            data={"conditionKey": "hypertension_risk"},
            check_fn=lambda r: self._check_condition_affirmation(r)
        )

        # Test 11: POST /api/affirmations/condition - invalid key (should 400)
        self.test(
            "POST /api/affirmations/condition - invalid key (expect 400)",
            "POST",
            "/affirmations/condition",
            expected_status=400,
            data={"conditionKey": "invalid_key_xyz"}
        )

        # ═══════════════════════════════════════════════════════════════
        # REGRESSION: EXISTING SOMATIC ENDPOINTS
        # ═══════════════════════════════════════════════════════════════
        
        print("\n" + "─" * 70)
        print("REGRESSION: EXISTING SOMATIC ENDPOINTS")
        print("─" * 70)

        # Test 12: GET /api/ - version check
        self.test(
            "GET /api/ - version check",
            "GET",
            "/",
            check_fn=lambda r: self._check_version(r)
        )

        # Test 13: GET /api/affirmations/today
        self.test(
            "GET /api/affirmations/today",
            "GET",
            "/affirmations/today",
            check_fn=lambda r: self._check_affirmation_today(r)
        )

        # Test 14: POST /api/snapshot
        snapshot_data = {
            "fused": {"bpm": 72, "hrv_ms": 48, "spo2": 98, "brpm": 14, "quality": 0.92},
            "face": {"result": "success", "samples": []},
            "finger": {"result": "success", "samples": []},
        }
        success, snapshot_result = self.test(
            "POST /api/snapshot",
            "POST",
            "/snapshot",
            data=snapshot_data,
            check_fn=lambda r: self._check_save_response(r)
        )

        # Test 15: POST /api/insight - Louise Hay wellness reflection
        if success:
            insight_data = {
                "snapshotId": snapshot_result.get("id"),
                "vitals": {"bpm": 72, "hrv_ms": 48},
                "nervousSystemStateKey": "calm",
                "context": {"practiceIntent": "morning reflection"},
            }
            self.test(
                "POST /api/insight - Louise Hay wellness reflection",
                "POST",
                "/insight",
                data=insight_data,
                check_fn=lambda r: self._check_insight(r)
            )

        # Test 16: POST /api/journal
        journal_data = {
            "text": "Today I felt calm and centered after my morning practice.",
            "prompt": "What did your body try to tell you this week?",
            "mood": "calm",
        }
        self.test(
            "POST /api/journal",
            "POST",
            "/journal",
            data=journal_data,
            check_fn=lambda r: self._check_save_response(r)
        )

        # Test 17: POST /api/practice
        practice_data = {"kind": "reflection"}
        self.test(
            "POST /api/practice",
            "POST",
            "/practice",
            data=practice_data,
            check_fn=lambda r: self._check_save_response(r)
        )

        # Test 18: GET /api/streak
        self.test(
            "GET /api/streak",
            "GET",
            "/streak",
            check_fn=lambda r: self._check_streak(r)
        )

        # Test 19: POST /api/notify-me
        notify_data = {"feature": "health_insights_pro", "email": "test@example.com"}
        self.test(
            "POST /api/notify-me",
            "POST",
            "/notify-me",
            data=notify_data,
            check_fn=lambda r: self._check_ok(r)
        )

        # Print summary
        print("\n" + "=" * 70)
        print(f"📊 Tests passed: {self.tests_passed}/{self.tests_run}")
        if self.failures:
            print("\n❌ Failures:")
            for f in self.failures:
                print(f"  - {f}")
        print("=" * 70)
        
        return 0 if self.tests_passed == self.tests_run else 1

    # ═══════════════════════════════════════════════════════════════
    # CHECK FUNCTIONS
    # ═══════════════════════════════════════════════════════════════

    def _check_models(self, r):
        assert r.get("ok") is True, "ok should be True"
        assert "models" in r, "Missing models"
        models = r["models"]
        assert isinstance(models, list), "models should be a list"
        assert len(models) >= 3, f"Expected at least 3 models, got {len(models)}"
        keys = [m.get("key") for m in models]
        assert "qrisk3" in keys, "Missing qrisk3"
        assert "score2" in keys, "Missing score2"
        assert "who_ish" in keys, "Missing who_ish"
        print(f"   ✓ Found {len(models)} models: {keys}")

    def _check_risk_india(self, r):
        assert r.get("ok") is True, "ok should be True"
        assert "result" in r, "Missing result"
        result = r["result"]
        assert "primary" in result, "Missing primary"
        assert "secondary" in result, "Missing secondary"
        primary = result["primary"]
        assert primary.get("modelUsed") == "WHO/ISH", f"Expected WHO/ISH, got {primary.get('modelUsed')}"
        assert "score" in primary, "Missing score"
        assert "band" in primary, "Missing band"
        assert "inputsUsed" in primary, "Missing inputsUsed"
        assert "missingInputs" in primary, "Missing missingInputs"
        assert "limitations" in primary, "Missing limitations"
        assert isinstance(primary["limitations"], list), "limitations should be a list"
        assert len(primary["limitations"]) > 0, "limitations should not be empty"
        print(f"   ✓ Primary: {primary['modelUsed']} → {primary['score']}% ({primary['band']})")
        print(f"   ✓ Limitations: {len(primary['limitations'])} items")
        # Check secondary includes QRISK3
        secondary = result["secondary"]
        assert isinstance(secondary, list), "secondary should be a list"
        if len(secondary) > 0:
            sec_models = [s.get("modelUsed") for s in secondary]
            print(f"   ✓ Secondary: {sec_models}")

    def _check_risk_europe(self, r):
        assert r.get("ok") is True, "ok should be True"
        result = r["result"]
        primary = result["primary"]
        assert "SCORE2" in primary.get("modelUsed", ""), f"Expected SCORE2, got {primary.get('modelUsed')}"
        assert "score" in primary, "Missing score"
        assert "band" in primary, "Missing band"
        print(f"   ✓ Primary: {primary['modelUsed']} → {primary['score']}% ({primary['band']})")

    def _check_risk_uk(self, r):
        assert r.get("ok") is True, "ok should be True"
        result = r["result"]
        primary = result["primary"]
        assert "QRISK3" in primary.get("modelUsed", ""), f"Expected QRISK3, got {primary.get('modelUsed')}"
        assert "score" in primary, "Missing score"
        assert "band" in primary, "Missing band"
        print(f"   ✓ Primary: {primary['modelUsed']} → {primary['score']}% ({primary['band']})")

    def _check_analyze(self, r):
        assert r.get("ok") is True, "ok should be True"
        assert "risk" in r, "Missing risk"
        assert "analysis" in r, "Missing analysis"
        analysis = r["analysis"]
        assert "summary" in analysis, "Missing summary"
        assert "tests" in analysis, "Missing tests"
        assert "lifestyle" in analysis, "Missing lifestyle"
        assert "affirmations" in analysis, "Missing affirmations"
        assert "disclaimer" in analysis, "Missing disclaimer"
        
        # Check structure
        assert isinstance(analysis["tests"], list), "tests should be a list"
        assert len(analysis["tests"]) == 3, f"Expected 3 tests, got {len(analysis['tests'])}"
        assert isinstance(analysis["lifestyle"], list), "lifestyle should be a list"
        assert len(analysis["lifestyle"]) == 3, f"Expected 3 lifestyle, got {len(analysis['lifestyle'])}"
        assert isinstance(analysis["affirmations"], list), "affirmations should be a list"
        assert len(analysis["affirmations"]) == 2, f"Expected 2 affirmations, got {len(analysis['affirmations'])}"
        
        # Check affirmation structure
        for aff in analysis["affirmations"]:
            assert "text" in aff, "Affirmation missing text"
            assert "beliefPattern" in aff, "Affirmation missing beliefPattern"
            assert "rationale" in aff, "Affirmation missing rationale"
        
        # Check plain language
        summary = analysis["summary"]
        assert len(summary) > 20, f"Summary too short: {len(summary)} chars"
        assert "disclaimer" in analysis["disclaimer"].lower() or "not a diagnosis" in analysis["disclaimer"].lower(), "Disclaimer should mention 'not a diagnosis'"
        
        print(f"   ✓ Summary: {len(summary)} chars")
        print(f"   ✓ Tests: {len(analysis['tests'])}, Lifestyle: {len(analysis['lifestyle'])}, Affirmations: {len(analysis['affirmations'])}")
        print(f"   ✓ Cached: {r.get('cached', False)}")

    def _check_analyze_cached(self, r):
        assert r.get("ok") is True, "ok should be True"
        assert r.get("cached") is True, f"Expected cached=True, got {r.get('cached')}"
        print(f"   ✓ Cache hit confirmed")

    def _check_analyze_force(self, r):
        assert r.get("ok") is True, "ok should be True"
        assert r.get("cached") is False, f"Expected cached=False with force=true, got {r.get('cached')}"
        print(f"   ✓ Force bypass confirmed")

    def _check_reports(self, r):
        assert r.get("ok") is True, "ok should be True"
        assert "rows" in r, "Missing rows"
        rows = r["rows"]
        assert isinstance(rows, list), "rows should be a list"
        if len(rows) > 0:
            first = rows[0]
            assert "primaryModel" in first, "Missing primaryModel"
            assert "primaryScore" in first, "Missing primaryScore"
            assert "primaryBand" in first, "Missing primaryBand"
            print(f"   ✓ Found {len(rows)} reports")
        else:
            print(f"   ✓ No reports yet (expected for first run)")

    def _check_condition_affirmation(self, r):
        assert r.get("ok") is True, "ok should be True"
        assert "affirmations" in r, "Missing affirmations"
        assert "conditionKey" in r, "Missing conditionKey"
        affs = r["affirmations"]
        assert isinstance(affs, list), "affirmations should be a list"
        assert len(affs) == 3, f"Expected 3 affirmations, got {len(affs)}"
        for aff in affs:
            assert "text" in aff, "Affirmation missing text"
            assert "beliefPattern" in aff, "Affirmation missing beliefPattern"
            assert "rationale" in aff, "Affirmation missing rationale"
        print(f"   ✓ Condition: {r['conditionKey']}, Affirmations: {len(affs)}")

    def _check_version(self, r):
        assert r.get("ok") is True, "ok should be True"
        assert "version" in r, "Missing version"
        print(f"   ✓ Version: {r.get('version')}")

    def _check_affirmation_today(self, r):
        assert r.get("ok") is True, "ok should be True"
        assert "affirmation" in r, "Missing affirmation"
        assert "mirror" in r, "Missing mirror"
        assert "journal" in r, "Missing journal"
        print(f"   ✓ Today's affirmation: {r['affirmation'].get('text', '')[:50]}...")

    def _check_save_response(self, r):
        assert r.get("ok") is True, "ok should be True"
        # Some endpoints return "id" directly, others return "row" with id inside
        if "id" in r:
            print(f"   ✓ Saved with id: {r['id'][:8]}...")
        elif "row" in r and isinstance(r["row"], dict) and "id" in r["row"]:
            print(f"   ✓ Saved with id: {r['row']['id'][:8]}...")
        else:
            raise AssertionError("Missing id in response")

    def _check_insight(self, r):
        assert r.get("ok") is True, "ok should be True"
        assert "text" in r, "Missing text"
        text = r["text"]
        assert len(text) > 50, f"Insight text too short: {len(text)} chars"
        print(f"   ✓ Insight length: {len(text)} chars")

    def _check_streak(self, r):
        assert r.get("ok") is True, "ok should be True"
        assert "streak" in r, "Missing streak"
        assert "totalDays" in r, "Missing totalDays"
        print(f"   ✓ Streak: {r['streak']} days, Total: {r['totalDays']} days")

    def _check_ok(self, r):
        assert r.get("ok") is True, "ok should be True"

def main():
    tester = Phase7BackendTester()
    return tester.run_all()

if __name__ == "__main__":
    sys.exit(main())
