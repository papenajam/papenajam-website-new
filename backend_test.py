#!/usr/bin/env python3
"""
Backend API Testing for Pengadilan Agama Penajam
Tests all critical endpoints with proper authentication flow
"""

import requests
import json
import uuid

# Configuration
BASE_URL = "https://justice-penajam.preview.emergentagent.com"
ADMIN_EMAIL = "admin@pa-penajam.go.id"
ADMIN_PASSWORD = "Admin@1234"

class APITester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.test_results = []
        
    def log_result(self, test_name, success, message, response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        self.test_results.append({
            'test': test_name,
            'success': success,
            'message': message,
            'data': response_data
        })
    
    def make_request(self, method, endpoint, data=None, auth_required=False):
        """Make HTTP request with proper headers"""
        url = f"{BASE_URL}/api{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'
            
        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=headers)
            else:
                return None, f"Unsupported method: {method}"
            
            return response, None
        except requests.exceptions.RequestException as e:
            return None, f"Request failed: {str(e)}"
    
    def test_seed_database(self):
        """Test 1: POST /api/seed - Seed database"""
        print("\n=== Testing Database Seeding ===")
        
        response, error = self.make_request('POST', '/seed')
        
        if error:
            self.log_result("Database Seed", False, f"Request error: {error}")
            return False
            
        if response.status_code == 200:
            result = response.json()
            self.log_result("Database Seed", True, "Database seeded successfully", result)
            return True
        else:
            self.log_result("Database Seed", False, f"Failed with status {response.status_code}: {response.text}")
            return False
    
    def test_auth_login(self):
        """Test 2: POST /api/auth/login - Admin login"""
        print("\n=== Testing Authentication ===")
        
        login_data = {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }
        
        response, error = self.make_request('POST', '/auth/login', login_data)
        
        if error:
            self.log_result("Admin Login", False, f"Request error: {error}")
            return False
            
        if response.status_code == 200:
            result = response.json()
            if 'token' in result:
                self.token = result['token']
                user_info = result.get('user', {})
                self.log_result("Admin Login", True, f"Login successful. User: {user_info.get('name', 'Unknown')}")
                return True
            else:
                self.log_result("Admin Login", False, "No token in response")
                return False
        else:
            self.log_result("Admin Login", False, f"Login failed with status {response.status_code}: {response.text}")
            return False
    
    def test_auth_verify(self):
        """Test 3: GET /api/auth/verify - Verify JWT token"""
        print("\n=== Testing Token Verification ===")
        
        if not self.token:
            self.log_result("Token Verification", False, "No token available for verification")
            return False
            
        response, error = self.make_request('GET', '/auth/verify', auth_required=True)
        
        if error:
            self.log_result("Token Verification", False, f"Request error: {error}")
            return False
            
        if response.status_code == 200:
            result = response.json()
            user = result.get('user', {})
            self.log_result("Token Verification", True, f"Token valid. User: {user.get('name', 'Unknown')}, Role: {user.get('role', 'Unknown')}")
            return True
        else:
            self.log_result("Token Verification", False, f"Verification failed with status {response.status_code}: {response.text}")
            return False
    
    def test_news_public(self):
        """Test 4: GET /api/news?public=true&limit=5 - Get published news"""
        print("\n=== Testing Public News Retrieval ===")
        
        response, error = self.make_request('GET', '/news?public=true&limit=5')
        
        if error:
            self.log_result("Public News", False, f"Request error: {error}")
            return False
            
        if response.status_code == 200:
            result = response.json()
            items = result.get('items', [])
            total = result.get('total', 0)
            self.log_result("Public News", True, f"Retrieved {len(items)} published news items (total: {total})")
            return True
        else:
            self.log_result("Public News", False, f"Failed with status {response.status_code}: {response.text}")
            return False
    
    def test_news_create(self):
        """Test 5: POST /api/news - Create news with auth"""
        print("\n=== Testing News Creation ===")
        
        if not self.token:
            self.log_result("News Creation", False, "No auth token available")
            return False
            
        news_data = {
            "title": "Test News - Pelayanan Digital PA Penajam",
            "content": "Pengadilan Agama Penajam terus meningkatkan pelayanan digital untuk memberikan akses keadilan yang lebih mudah bagi masyarakat. Inovasi terbaru ini meliputi layanan pendaftaran perkara online dan sistem informasi yang terintegrasi.",
            "image": "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&q=80",
            "author": "Tim IT PA Penajam",
            "category": "Teknologi",
            "isPublished": True,
            "publishDate": "2025-06-01"
        }
        
        response, error = self.make_request('POST', '/news', news_data, auth_required=True)
        
        if error:
            self.log_result("News Creation", False, f"Request error: {error}")
            return False
            
        if response.status_code == 201:
            result = response.json()
            news_id = result.get('id')
            self.log_result("News Creation", True, f"News created successfully with ID: {news_id}")
            # Store for cleanup
            self.created_news_id = news_id
            return True
        else:
            self.log_result("News Creation", False, f"Failed with status {response.status_code}: {response.text}")
            return False
    
    def test_announcements_public(self):
        """Test 6: GET /api/announcements?public=true&limit=4 - Get active announcements"""
        print("\n=== Testing Public Announcements Retrieval ===")
        
        response, error = self.make_request('GET', '/announcements?public=true&limit=4')
        
        if error:
            self.log_result("Public Announcements", False, f"Request error: {error}")
            return False
            
        if response.status_code == 200:
            result = response.json()
            items = result.get('items', [])
            total = result.get('total', 0)
            self.log_result("Public Announcements", True, f"Retrieved {len(items)} active announcements (total: {total})")
            return True
        else:
            self.log_result("Public Announcements", False, f"Failed with status {response.status_code}: {response.text}")
            return False
    
    def test_cases_list(self):
        """Test 7: GET /api/cases?page=1&limit=5 - Get cases list"""
        print("\n=== Testing Cases List Retrieval ===")
        
        response, error = self.make_request('GET', '/cases?page=1&limit=5')
        
        if error:
            self.log_result("Cases List", False, f"Request error: {error}")
            return False
            
        if response.status_code == 200:
            result = response.json()
            items = result.get('items', [])
            total = result.get('total', 0)
            page = result.get('page', 1)
            total_pages = result.get('totalPages', 0)
            self.log_result("Cases List", True, f"Retrieved {len(items)} cases (page {page}/{total_pages}, total: {total})")
            return True
        else:
            self.log_result("Cases List", False, f"Failed with status {response.status_code}: {response.text}")
            return False
    
    def test_cases_create(self):
        """Test 8: POST /api/cases - Create case with auth"""
        print("\n=== Testing Case Creation ===")
        
        if not self.token:
            self.log_result("Case Creation", False, "No auth token available")
            return False
            
        from datetime import datetime
        current_year = datetime.now().year
        
        case_data = {
            "nomorPerkara": f"TEST/{current_year}/PA.Pnj",
            "tahun": str(current_year),
            "jenisPerkara": "Test - Cerai Gugat",
            "pemohon": "Test Pemohon bin Testing",
            "termohon": "Test Termohon binti Testing",
            "status": "terdaftar",
            "jadwalSidang": f"{current_year}-07-01",
            "ruangSidang": "Ruang Sidang Test",
            "hakim": "Test Judge, S.H., M.H."
        }
        
        response, error = self.make_request('POST', '/cases', case_data, auth_required=True)
        
        if error:
            self.log_result("Case Creation", False, f"Request error: {error}")
            return False
            
        if response.status_code == 201:
            result = response.json()
            case_id = result.get('id')
            case_number = result.get('nomorPerkara')
            self.log_result("Case Creation", True, f"Case created successfully - ID: {case_id}, Number: {case_number}")
            # Store for cleanup
            self.created_case_id = case_id
            return True
        else:
            self.log_result("Case Creation", False, f"Failed with status {response.status_code}: {response.text}")
            return False
    
    def test_services_list(self):
        """Test 9: GET /api/services - Get services list"""
        print("\n=== Testing Services List Retrieval ===")
        
        response, error = self.make_request('GET', '/services')
        
        if error:
            self.log_result("Services List", False, f"Request error: {error}")
            return False
            
        if response.status_code == 200:
            result = response.json()
            items = result.get('items', [])
            self.log_result("Services List", True, f"Retrieved {len(items)} services")
            return True
        else:
            self.log_result("Services List", False, f"Failed with status {response.status_code}: {response.text}")
            return False
    
    def test_stats(self):
        """Test 10: GET /api/stats - Get dashboard stats with auth"""
        print("\n=== Testing Dashboard Statistics ===")
        
        if not self.token:
            self.log_result("Dashboard Stats", False, "No auth token available")
            return False
            
        response, error = self.make_request('GET', '/stats', auth_required=True)
        
        if error:
            self.log_result("Dashboard Stats", False, f"Request error: {error}")
            return False
            
        if response.status_code == 200:
            result = response.json()
            stats = {
                'news': result.get('totalNews', 0),
                'announcements': result.get('totalAnnouncements', 0),
                'services': result.get('totalServices', 0),
                'cases': result.get('totalCases', 0),
                'users': result.get('totalUsers', 0),
                'cases_this_year': result.get('casesThisYear', 0),
                'cases_done': result.get('casesDone', 0),
                'cases_ongoing': result.get('casesOngoing', 0)
            }
            self.log_result("Dashboard Stats", True, f"Stats retrieved: {stats}")
            return True
        else:
            self.log_result("Dashboard Stats", False, f"Failed with status {response.status_code}: {response.text}")
            return False
    
    def test_settings_get(self):
        """Test 11: GET /api/settings - Get settings (public)"""
        print("\n=== Testing Settings Retrieval ===")
        
        response, error = self.make_request('GET', '/settings')
        
        if error:
            self.log_result("Settings Get", False, f"Request error: {error}")
            return False
            
        if response.status_code == 200:
            result = response.json()
            settings_count = len(result)
            court_name = result.get('court_name', 'Not found')
            self.log_result("Settings Get", True, f"Retrieved {settings_count} settings. Court name: {court_name}")
            return True
        else:
            self.log_result("Settings Get", False, f"Failed with status {response.status_code}: {response.text}")
            return False
    
    def test_settings_update(self):
        """Test 12: PUT /api/settings - Update settings with auth"""
        print("\n=== Testing Settings Update ===")
        
        if not self.token:
            self.log_result("Settings Update", False, "No auth token available")
            return False
            
        settings_data = {
            "test_setting": "Test value from API testing",
            "last_api_test": "2025-06-01"
        }
        
        response, error = self.make_request('PUT', '/settings', settings_data, auth_required=True)
        
        if error:
            self.log_result("Settings Update", False, f"Request error: {error}")
            return False
            
        if response.status_code == 200:
            result = response.json()
            message = result.get('message', 'No message')
            self.log_result("Settings Update", True, f"Settings updated: {message}")
            return True
        else:
            self.log_result("Settings Update", False, f"Failed with status {response.status_code}: {response.text}")
            return False
    
    def test_additional_scenarios(self):
        """Test additional scenarios like pagination, search, filtering"""
        print("\n=== Testing Additional Scenarios ===")
        
        # Test news pagination
        response, _ = self.make_request('GET', '/news?page=2&limit=2')
        if response and response.status_code == 200:
            self.log_result("News Pagination", True, "Pagination working for news")
        else:
            self.log_result("News Pagination", False, "Pagination failed for news")
        
        # Test news search
        response, _ = self.make_request('GET', '/news?search=Pengadilan')
        if response and response.status_code == 200:
            result = response.json()
            items = result.get('items', [])
            self.log_result("News Search", True, f"Search returned {len(items)} results")
        else:
            self.log_result("News Search", False, "Search failed for news")
        
        # Test cases year filter
        from datetime import datetime
        current_year = datetime.now().year
        response, _ = self.make_request('GET', f'/cases?tahun={current_year}')
        if response and response.status_code == 200:
            result = response.json()
            items = result.get('items', [])
            self.log_result("Cases Year Filter", True, f"Year filter returned {len(items)} cases for {current_year}")
        else:
            self.log_result("Cases Year Filter", False, f"Year filter failed for cases")
    
    def cleanup_test_data(self):
        """Clean up test data created during testing"""
        print("\n=== Cleaning Up Test Data ===")
        
        if hasattr(self, 'created_news_id') and self.created_news_id:
            response, _ = self.make_request('DELETE', f'/news/{self.created_news_id}', auth_required=True)
            if response and response.status_code == 200:
                self.log_result("Cleanup News", True, "Test news deleted successfully")
            else:
                self.log_result("Cleanup News", False, "Failed to delete test news")
        
        if hasattr(self, 'created_case_id') and self.created_case_id:
            response, _ = self.make_request('DELETE', f'/cases/{self.created_case_id}', auth_required=True)
            if response and response.status_code == 200:
                self.log_result("Cleanup Case", True, "Test case deleted successfully")
            else:
                self.log_result("Cleanup Case", False, "Failed to delete test case")
    
    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Pengadilan Agama Penajam API Tests")
        print(f"Testing against: {BASE_URL}")
        print("=" * 60)
        
        try:
            # Core functionality tests
            self.test_seed_database()
            self.test_auth_login()
            self.test_auth_verify()
            
            # CRUD operations tests
            self.test_news_public()
            self.test_news_create()
            self.test_announcements_public()
            self.test_cases_list()
            self.test_cases_create()
            self.test_services_list()
            self.test_stats()
            self.test_settings_get()
            self.test_settings_update()
            
            # Additional scenarios
            self.test_additional_scenarios()
            
            # Clean up
            self.cleanup_test_data()
            
        except Exception as e:
            print(f"\n💥 Unexpected error during testing: {str(e)}")
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total*100):.1f}%")
        
        # List failed tests
        failed_tests = [result for result in self.test_results if not result['success']]
        if failed_tests:
            print(f"\n❌ Failed Tests:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['message']}")
        else:
            print(f"\n🎉 All tests passed!")
        
        return passed == total

if __name__ == "__main__":
    tester = APITester()
    success = tester.run_all_tests()
    exit(0 if success else 1)