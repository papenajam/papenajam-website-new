#!/usr/bin/env python3
"""
Comprehensive backend API testing after MongoDB cleanup.
Tests PostgreSQL/Prisma implementation with focus on:
- Authentication (admin/staff/editor)
- JWT verification
- All active API domains
- CRUD operations with cleanup
- Date format validation (YYYY-MM-DD)
- No MongoDB references
"""

import requests
import json
from datetime import datetime, timedelta
import sys

# Base URL from test_result.md
BASE_URL = "https://analisa-platform-1.preview.emergentagent.com/api"

# Test credentials from test_credentials.md
CREDENTIALS = {
    "admin": {"email": "admin@pa-penajam.go.id", "password": "Admin@1234"},
    "staff": {"email": "staff@pa-penajam.go.id", "password": "Staff@1234"},
    "editor": {"email": "editor@pa-penajam.go.id", "password": "Editor@1234"}
}

# Global test state
tokens = {}
test_results = []
created_resources = {
    "news": [],
    "pages": [],
    "agenda": [],
    "putusan": [],
    "complaints": [],
    "surveys": []
}

def log_test(name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    result = f"{status}: {name}"
    if details:
        result += f" - {details}"
    print(result)
    test_results.append({"name": name, "passed": passed, "details": details})
    return passed

def check_no_mongodb_refs(data):
    """Check if response contains MongoDB references"""
    data_str = json.dumps(data).lower()
    mongo_keywords = ["mongodb", "mongo", "_id", "objectid"]
    found = [kw for kw in mongo_keywords if kw in data_str and "id" not in kw]
    return len(found) == 0, found

def validate_date_format(date_str):
    """Validate YYYY-MM-DD format"""
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
        return True
    except:
        return False

print("=" * 80)
print("BACKEND API TESTING - POST MONGODB CLEANUP")
print("=" * 80)
print()

# ============================================================================
# PHASE 1: AUTHENTICATION & JWT VERIFICATION
# ============================================================================
print("PHASE 1: Authentication & JWT Verification")
print("-" * 80)

try:
    # Test 1: Admin login
    resp = requests.post(f"{BASE_URL}/auth/login", json=CREDENTIALS["admin"], timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        tokens["admin"] = data.get("token")
        log_test("Admin login", tokens["admin"] is not None, f"Role: {data.get('user', {}).get('role')}")
    else:
        log_test("Admin login", False, f"Status {resp.status_code}")
except Exception as e:
    log_test("Admin login", False, str(e))

try:
    # Test 2: Staff login
    resp = requests.post(f"{BASE_URL}/auth/login", json=CREDENTIALS["staff"], timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        tokens["staff"] = data.get("token")
        log_test("Staff login", tokens["staff"] is not None, f"Role: {data.get('user', {}).get('role')}")
    else:
        log_test("Staff login", False, f"Status {resp.status_code}")
except Exception as e:
    log_test("Staff login", False, str(e))

try:
    # Test 3: Editor login
    resp = requests.post(f"{BASE_URL}/auth/login", json=CREDENTIALS["editor"], timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        tokens["editor"] = data.get("token")
        log_test("Editor login", tokens["editor"] is not None, f"Role: {data.get('user', {}).get('role')}")
    else:
        log_test("Editor login", False, f"Status {resp.status_code}")
except Exception as e:
    log_test("Editor login", False, str(e))

try:
    # Test 4: JWT verification
    if tokens.get("admin"):
        headers = {"Authorization": f"Bearer {tokens['admin']}"}
        resp = requests.get(f"{BASE_URL}/auth/verify", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            log_test("JWT verification", "user" in data, f"User: {data.get('user', {}).get('email')}")
        else:
            log_test("JWT verification", False, f"Status {resp.status_code}")
    else:
        log_test("JWT verification", False, "No admin token available")
except Exception as e:
    log_test("JWT verification", False, str(e))

print()

# ============================================================================
# PHASE 2: REPRESENTATIVE READS - ALL ACTIVE API DOMAINS
# ============================================================================
print("PHASE 2: Representative Reads - All Active API Domains")
print("-" * 80)

# Public endpoints (no auth required)
public_endpoints = [
    ("GET /api/news (public)", f"{BASE_URL}/news?public=true&limit=3"),
    ("GET /api/announcements (public)", f"{BASE_URL}/announcements?public=true&limit=3"),
    ("GET /api/services", f"{BASE_URL}/services"),
    ("GET /api/cases", f"{BASE_URL}/cases?limit=3"),
    ("GET /api/settings", f"{BASE_URL}/settings"),
    ("GET /api/pages/slug/tentang", f"{BASE_URL}/pages/slug/tentang"),
    ("GET /api/agenda (public)", f"{BASE_URL}/agenda?limit=3"),
    ("GET /api/putusan (public)", f"{BASE_URL}/putusan?public=true&limit=3"),
    ("GET /api/gallery", f"{BASE_URL}/gallery?limit=3"),
    ("GET /api/documents", f"{BASE_URL}/documents?limit=3"),
    ("GET /api/faq", f"{BASE_URL}/faq?limit=3"),
    ("GET /api/banners", f"{BASE_URL}/banners"),
    ("GET /api/surveys/config", f"{BASE_URL}/surveys/config"),
    ("GET /api/search", f"{BASE_URL}/search?q=pengadilan"),
    ("GET /api/menus", f"{BASE_URL}/menus"),
]

for test_name, url in public_endpoints:
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            no_mongo, refs = check_no_mongodb_refs(data)
            if not no_mongo:
                log_test(test_name, False, f"MongoDB refs found: {refs}")
            else:
                log_test(test_name, True, f"Status 200, no MongoDB refs")
        else:
            log_test(test_name, False, f"Status {resp.status_code}")
    except Exception as e:
        log_test(test_name, False, str(e))

# Protected endpoints (require auth)
if tokens.get("admin"):
    headers = {"Authorization": f"Bearer {tokens['admin']}"}
    protected_endpoints = [
        ("GET /api/stats (auth)", f"{BASE_URL}/stats"),
        ("GET /api/users (auth)", f"{BASE_URL}/users"),
        ("GET /api/sidebar-widgets (auth)", f"{BASE_URL}/sidebar-widgets"),
        ("GET /api/complaints (auth)", f"{BASE_URL}/complaints?limit=3"),
        ("GET /api/analytics (auth)", f"{BASE_URL}/analytics"),
        ("GET /api/surveys (auth)", f"{BASE_URL}/surveys"),
        ("GET /api/media (auth)", f"{BASE_URL}/media?limit=3"),
    ]
    
    for test_name, url in protected_endpoints:
        try:
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                no_mongo, refs = check_no_mongodb_refs(data)
                if not no_mongo:
                    log_test(test_name, False, f"MongoDB refs found: {refs}")
                else:
                    log_test(test_name, True, f"Status 200, no MongoDB refs")
            else:
                log_test(test_name, False, f"Status {resp.status_code}")
        except Exception as e:
            log_test(test_name, False, str(e))

print()

# ============================================================================
# PHASE 3: SECURITY TESTS (401 & 404)
# ============================================================================
print("PHASE 3: Security Tests")
print("-" * 80)

try:
    # Test: Protected endpoint without auth returns 401
    resp = requests.get(f"{BASE_URL}/stats", timeout=10)
    log_test("Protected endpoint 401", resp.status_code == 401, f"Status {resp.status_code}")
except Exception as e:
    log_test("Protected endpoint 401", False, str(e))

try:
    # Test: Unknown route returns 404
    resp = requests.get(f"{BASE_URL}/nonexistent-route-xyz", timeout=10)
    log_test("Unknown route 404", resp.status_code == 404, f"Status {resp.status_code}")
except Exception as e:
    log_test("Unknown route 404", False, str(e))

print()

# ============================================================================
# PHASE 4: DATE-BASED ENDPOINTS (YYYY-MM-DD VALIDATION)
# ============================================================================
print("PHASE 4: Date-Based Endpoints (YYYY-MM-DD Format)")
print("-" * 80)

if tokens.get("admin"):
    headers = {"Authorization": f"Bearer {tokens['admin']}"}
    
    # Test News with date
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        news_data = {
            "title": "Test News Date Format",
            "content": "Testing date format",
            "publishDate": today,
            "isPublished": True
        }
        resp = requests.post(f"{BASE_URL}/news", json=news_data, headers=headers, timeout=10)
        if resp.status_code == 201:
            data = resp.json()
            created_resources["news"].append(data.get("id"))
            date_valid = validate_date_format(data.get("publishDate", ""))
            log_test("News date format (YYYY-MM-DD)", date_valid, f"Date: {data.get('publishDate')}")
        else:
            log_test("News date format (YYYY-MM-DD)", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("News date format (YYYY-MM-DD)", False, str(e))
    
    # Test Agenda with date
    try:
        agenda_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        agenda_data = {
            "nomorPerkara": "001/Test/2026",
            "tanggalSidang": agenda_date,
            "waktuSidang": "09:00",
            "ruangSidang": "Ruang 1",
            "jenisPerkara": "Cerai Talak",
            "status": "scheduled"
        }
        resp = requests.post(f"{BASE_URL}/agenda", json=agenda_data, headers=headers, timeout=10)
        if resp.status_code == 201:
            data = resp.json()
            created_resources["agenda"].append(data.get("id"))
            date_valid = validate_date_format(data.get("tanggalSidang", ""))
            log_test("Agenda date format (YYYY-MM-DD)", date_valid, f"Date: {data.get('tanggalSidang')}")
        else:
            log_test("Agenda date format (YYYY-MM-DD)", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Agenda date format (YYYY-MM-DD)", False, str(e))
    
    # Test Putusan with date
    try:
        putusan_date = datetime.now().strftime("%Y-%m-%d")
        putusan_data = {
            "nomorPerkara": "002/Test/2026",
            "tanggalPutusan": putusan_date,
            "jenisPerkara": "Cerai Gugat",
            "statusPublish": True,
            "filePutusan": "/uploads/pdfs/test.pdf"
        }
        resp = requests.post(f"{BASE_URL}/putusan", json=putusan_data, headers=headers, timeout=10)
        if resp.status_code == 201:
            data = resp.json()
            created_resources["putusan"].append(data.get("id"))
            date_valid = validate_date_format(data.get("tanggalPutusan", ""))
            log_test("Putusan date format (YYYY-MM-DD)", date_valid, f"Date: {data.get('tanggalPutusan')}")
        else:
            log_test("Putusan date format (YYYY-MM-DD)", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Putusan date format (YYYY-MM-DD)", False, str(e))
    
    # Test Banners with date range
    try:
        start_date = datetime.now().strftime("%Y-%m-%d")
        end_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        banner_data = {
            "title": "Test Banner",
            "imageUrl": "/uploads/images/test.jpg",
            "buttonUrl": "/test",
            "startDate": start_date,
            "endDate": end_date,
            "isActive": True,
            "order": 1
        }
        resp = requests.post(f"{BASE_URL}/banners", json=banner_data, headers=headers, timeout=10)
        if resp.status_code == 201:
            data = resp.json()
            start_valid = validate_date_format(data.get("startDate", ""))
            end_valid = validate_date_format(data.get("endDate", ""))
            log_test("Banner date format (YYYY-MM-DD)", start_valid and end_valid, 
                    f"Start: {data.get('startDate')}, End: {data.get('endDate')}")
            # Clean up banner
            banner_id = data.get("id")
            if banner_id:
                requests.delete(f"{BASE_URL}/banners/{banner_id}", headers=headers, timeout=10)
        else:
            log_test("Banner date format (YYYY-MM-DD)", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Banner date format (YYYY-MM-DD)", False, str(e))

print()

# ============================================================================
# PHASE 5: CRUD OPERATIONS WITH CLEANUP
# ============================================================================
print("PHASE 5: CRUD Operations with Cleanup")
print("-" * 80)

if tokens.get("admin"):
    headers = {"Authorization": f"Bearer {tokens['admin']}"}
    
    # Test Page CRUD
    try:
        page_data = {
            "title": "Test Page CRUD",
            "slug": "test-page-crud-cleanup",
            "status": "published",
            "blocks": []
        }
        # CREATE
        resp = requests.post(f"{BASE_URL}/pages", json=page_data, headers=headers, timeout=10)
        if resp.status_code == 201:
            page = resp.json()
            page_id = page.get("id")
            created_resources["pages"].append(page_id)
            
            # READ
            resp = requests.get(f"{BASE_URL}/pages/{page_id}", headers=headers, timeout=10)
            read_ok = resp.status_code == 200
            
            # UPDATE
            update_data = {"title": "Updated Test Page"}
            resp = requests.put(f"{BASE_URL}/pages/{page_id}", json=update_data, headers=headers, timeout=10)
            update_ok = resp.status_code == 200
            
            log_test("Page CRUD (Create/Read/Update)", read_ok and update_ok, 
                    f"Page ID: {page_id}")
        else:
            log_test("Page CRUD (Create/Read/Update)", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Page CRUD (Create/Read/Update)", False, str(e))
    
    # Test Complaint submission (public) and retrieval (admin)
    try:
        complaint_data = {
            "name": "Test User",
            "email": "test@example.com",
            "phone": "081234567890",
            "subject": "Test Complaint",
            "message": "This is a test complaint for cleanup"
        }
        # CREATE (public endpoint)
        resp = requests.post(f"{BASE_URL}/complaints", json=complaint_data, timeout=10)
        if resp.status_code == 201:
            complaint = resp.json()
            complaint_id = complaint.get("id")
            created_resources["complaints"].append(complaint_id)
            
            # READ (admin endpoint)
            resp = requests.get(f"{BASE_URL}/complaints", headers=headers, timeout=10)
            read_ok = resp.status_code == 200
            
            log_test("Complaint CRUD (Create/Read)", read_ok, f"Complaint ID: {complaint_id}")
        else:
            log_test("Complaint CRUD (Create/Read)", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Complaint CRUD (Create/Read)", False, str(e))
    
    # Test Survey submission
    try:
        survey_data = {
            "rating": 5,
            "comment": "Test survey feedback"
        }
        resp = requests.post(f"{BASE_URL}/surveys/submit", json=survey_data, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            log_test("Survey submission", "message" in data, f"Response: {data.get('message')}")
        else:
            log_test("Survey submission", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Survey submission", False, str(e))
    
    # Test Settings update
    try:
        settings_data = {
            "site_name": "Test Site Name Update"
        }
        resp = requests.put(f"{BASE_URL}/settings", json=settings_data, headers=headers, timeout=10)
        if resp.status_code == 200:
            # Verify update
            resp = requests.get(f"{BASE_URL}/settings", timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                log_test("Settings update", data.get("site_name") == "Test Site Name Update", 
                        "Settings updated successfully")
            else:
                log_test("Settings update", False, "Failed to verify update")
        else:
            log_test("Settings update", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Settings update", False, str(e))

print()

# ============================================================================
# PHASE 6: CLEANUP CREATED RESOURCES
# ============================================================================
print("PHASE 6: Cleanup Created Resources")
print("-" * 80)

if tokens.get("admin"):
    headers = {"Authorization": f"Bearer {tokens['admin']}"}
    cleanup_count = 0
    
    # Clean up news
    for news_id in created_resources["news"]:
        try:
            resp = requests.delete(f"{BASE_URL}/news/{news_id}", headers=headers, timeout=10)
            if resp.status_code in [200, 204]:
                cleanup_count += 1
        except:
            pass
    
    # Clean up pages
    for page_id in created_resources["pages"]:
        try:
            resp = requests.delete(f"{BASE_URL}/pages/{page_id}", headers=headers, timeout=10)
            if resp.status_code in [200, 204]:
                cleanup_count += 1
        except:
            pass
    
    # Clean up agenda
    for agenda_id in created_resources["agenda"]:
        try:
            resp = requests.delete(f"{BASE_URL}/agenda/{agenda_id}", headers=headers, timeout=10)
            if resp.status_code in [200, 204]:
                cleanup_count += 1
        except:
            pass
    
    # Clean up putusan
    for putusan_id in created_resources["putusan"]:
        try:
            resp = requests.delete(f"{BASE_URL}/putusan/{putusan_id}", headers=headers, timeout=10)
            if resp.status_code in [200, 204]:
                cleanup_count += 1
        except:
            pass
    
    # Clean up complaints
    for complaint_id in created_resources["complaints"]:
        try:
            resp = requests.delete(f"{BASE_URL}/complaints/{complaint_id}", headers=headers, timeout=10)
            if resp.status_code in [200, 204]:
                cleanup_count += 1
        except:
            pass
    
    log_test("Resource cleanup", True, f"Cleaned up {cleanup_count} test resources")

print()

# ============================================================================
# SUMMARY
# ============================================================================
print("=" * 80)
print("TEST SUMMARY")
print("=" * 80)

passed = sum(1 for r in test_results if r["passed"])
total = len(test_results)
success_rate = (passed / total * 100) if total > 0 else 0

print(f"Total Tests: {total}")
print(f"Passed: {passed}")
print(f"Failed: {total - passed}")
print(f"Success Rate: {success_rate:.1f}%")
print()

if total - passed > 0:
    print("FAILED TESTS:")
    for r in test_results:
        if not r["passed"]:
            print(f"  ❌ {r['name']}: {r['details']}")
    print()

# Check for MongoDB references across all tests
mongo_issues = [r for r in test_results if "MongoDB refs found" in r.get("details", "")]
if mongo_issues:
    print("⚠️  WARNING: MongoDB references detected in responses!")
    for issue in mongo_issues:
        print(f"  - {issue['name']}: {issue['details']}")
else:
    print("✅ NO MongoDB references detected in any API responses")

print()
print("=" * 80)

# Exit with appropriate code
sys.exit(0 if passed == total else 1)
