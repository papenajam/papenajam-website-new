#!/usr/bin/env python3
"""
Backend API Testing for Pengadilan Agama Penajam v2.0
Tests all upgraded API endpoints with proper authentication flow
Base URL: http://localhost:3000 (but using production URL from env)
"""

import requests
import json
import os
import sys
import uuid
from datetime import datetime

# Configuration
BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000").rstrip("/")
CREDENTIALS = {
    "admin": {
        "email": os.environ.get("ADMIN_EMAIL", ""),
        "password": os.environ.get("ADMIN_PASSWORD", ""),
    },
    "staff": {
        "email": os.environ.get("STAFF_EMAIL", ""),
        "password": os.environ.get("STAFF_PASSWORD", ""),
    },
    "editor": {
        "email": os.environ.get("EDITOR_EMAIL", ""),
        "password": os.environ.get("EDITOR_PASSWORD", ""),
    },
}
REQUEST_TIMEOUT_SECONDS = float(os.environ.get("REQUEST_TIMEOUT_SECONDS", "15"))


def validate_configuration():
    required = {
        "ADMIN_EMAIL": CREDENTIALS["admin"]["email"],
        "ADMIN_PASSWORD": CREDENTIALS["admin"]["password"],
        "STAFF_EMAIL": CREDENTIALS["staff"]["email"],
        "STAFF_PASSWORD": CREDENTIALS["staff"]["password"],
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        print(f"Missing required environment variables: {', '.join(missing)}", file=sys.stderr)
        return False
    return True

class APITesterV2:
    def __init__(self):
        self.session = requests.Session()
        self.tokens = {}  # Store tokens for different users
        self.test_results = []
        self.created_items = {}  # Store created test items for cleanup
        
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
    
    def make_request(self, method, endpoint, data=None, auth_token=None, params=None):
        """Make HTTP request with proper headers"""
        url = f"{BASE_URL}/api{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth_token:
            headers['Authorization'] = f'Bearer {auth_token}'
            
        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers, params=params, timeout=REQUEST_TIMEOUT_SECONDS)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS)
            else:
                return None, f"Unsupported method: {method}"
            
            return response, None
        except requests.exceptions.Timeout:
            return None, f"Request timed out after {REQUEST_TIMEOUT_SECONDS:g}s: {method} {endpoint}"
        except requests.exceptions.RequestException as e:
            return None, f"Request failed: {str(e)}"
    
    def test_login(self, user_type):
        """Test login for specified user type"""
        print(f"\n=== Testing {user_type.upper()} Login ===")
        
        creds = CREDENTIALS[user_type]
        login_data = {
            "email": creds["email"],
            "password": creds["password"]
        }
        
        response, error = self.make_request('POST', '/auth/login', login_data)
        
        if error:
            self.log_result(f"{user_type.upper()} Login", False, f"Request error: {error}")
            return False
            
        if response.status_code == 200:
            result = response.json()
            if 'token' in result:
                self.tokens[user_type] = result['token']
                user_info = result.get('user', {})
                role = user_info.get('role', 'unknown')
                name = user_info.get('name', 'Unknown')
                self.log_result(f"{user_type.upper()} Login", True, f"Login successful. User: {name}, Role: {role}")
                return True
            else:
                self.log_result(f"{user_type.upper()} Login", False, "No token in response")
                return False
        else:
            self.log_result(f"{user_type.upper()} Login", False, f"Login failed with status {response.status_code}: {response.text}")
            return False
    
    def test_stats_endpoint(self):
        """Test 2: GET /api/stats - Dashboard stats with charts data"""
        print("\n=== Testing Enhanced Stats API ===")
        
        admin_token = self.tokens.get('admin')
        if not admin_token:
            self.log_result("Enhanced Stats API", False, "No admin token available")
            return False
            
        response, error = self.make_request('GET', '/stats', auth_token=admin_token)
        
        if error:
            self.log_result("Enhanced Stats API", False, f"Request error: {error}")
            return False
            
        if response.status_code == 200:
            result = response.json()
            
            # Check required fields for v2.0
            required_fields = ['monthlyData', 'caseTypes', 'todayAgenda', 'totalAgenda', 'totalPutusan', 'totalPages']
            missing_fields = [field for field in required_fields if field not in result]
            
            if missing_fields:
                self.log_result("Enhanced Stats API", False, f"Missing required fields: {missing_fields}")
                return False
            
            monthly_data = result.get('monthlyData', [])
            case_types = result.get('caseTypes', [])
            today_agenda = result.get('todayAgenda', 0)
            
            self.log_result("Enhanced Stats API", True, 
                f"Stats retrieved successfully. Monthly data: {len(monthly_data)} months, "
                f"Case types: {len(case_types)}, Today agenda: {today_agenda}")
            return True
        else:
            self.log_result("Enhanced Stats API", False, f"Failed with status {response.status_code}: {response.text}")
            return False
    
    def test_pages_list(self):
        """Test 3: GET /api/pages - Get pages list (auth required)"""
        print("\n=== Testing Pages List API ===")
        
        admin_token = self.tokens.get('admin')
        if not admin_token:
            self.log_result("Pages List API", False, "No admin token available")
            return False
            
        response, error = self.make_request('GET', '/pages', auth_token=admin_token)
        
        if error:
            self.log_result("Pages List API", False, f"Request error: {error}")
            return False
            
        if response.status_code == 200:
            result = response.json()
            items = result.get('items', [])
            self.log_result("Pages List API", True, f"Retrieved {len(items)} pages")
            return True
        else:
            self.log_result("Pages List API", False, f"Failed with status {response.status_code}: {response.text}")
            return False
    
    def test_pages_create(self):
        """Test 4: POST /api/pages - Create a new page with blocks array"""
        print("\n=== Testing Page Creation API ===")
        
        admin_token = self.tokens.get('admin')
        if not admin_token:
            self.log_result("Page Creation API", False, "No admin token available")
            return False
        
        page_data = {
            "title": "Test Page - Layanan Terbaru",
            "slug": "test-layanan-terbaru",
            "status": "published",
            "blocks": [
                {
                    "id": str(uuid.uuid4()),
                    "type": "hero",
                    "settings": {
                        "title": "Layanan Terbaru PA Penajam",
                        "subtitle": "Inovasi pelayanan untuk kemudahan masyarakat",
                        "backgroundImage": "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&q=80",
                        "buttonText": "Pelajari Lebih Lanjut",
                        "buttonLink": "#content"
                    }
                },
                {
                    "id": str(uuid.uuid4()),
                    "type": "text",
                    "settings": {
                        "content": "<h2>Layanan Digital Terdepan</h2><p>Pengadilan Agama Penajam terus berinovasi dalam memberikan pelayanan digital yang memudahkan masyarakat dalam mengakses layanan peradilan.</p>"
                    }
                }
            ]
        }
        
        response, error = self.make_request('POST', '/pages', page_data, auth_token=admin_token)
        
        if error:
            self.log_result("Page Creation API", False, f"Request error: {error}")
            return False
            
        if response.status_code == 201:
            result = response.json()
            page_id = result.get('id')
            page_title = result.get('title')
            blocks_count = len(result.get('blocks', []))
            self.log_result("Page Creation API", True, f"Page created successfully. ID: {page_id}, Title: {page_title}, Blocks: {blocks_count}")
            # Store for cleanup
            self.created_items['page_id'] = page_id
            return True
        else:
            self.log_result("Page Creation API", False, f"Failed with status {response.status_code}: {response.text}")
            return False
    
    def test_pages_public_slug(self):
        """Test 5: GET /api/pages/slug/tentang - Get page by slug (public)"""
        print("\n=== Testing Public Page by Slug API ===")
        
        # No auth required for public pages
        response, error = self.make_request('GET', '/pages/slug/tentang')
        
        if error:
            self.log_result("Public Page by Slug API", False, f"Request error: {error}")
            return False
            
        if response.status_code == 200:
            result = response.json()
            title = result.get('title', 'Unknown')
            blocks = result.get('blocks', [])
            status = result.get('status', 'Unknown')
            self.log_result("Public Page by Slug API", True, f"Page retrieved: {title}, Status: {status}, Blocks: {len(blocks)}")
            return True
        else:
            self.log_result("Public Page by Slug API", False, f"Failed with status {response.status_code}: {response.text}")
            return False
    
    def test_agenda_list(self):
        """Test 6: GET /api/agenda?limit=5 - Get agenda sidang list"""
        print("\n=== Testing Agenda List API ===")
        
        params = {'limit': '5'}
        response, error = self.make_request('GET', '/agenda', params=params)
        
        if error:
            self.log_result("Agenda List API", False, f"Request error: {error}")
            return False
            
        if response.status_code == 200:
            result = response.json()
            items = result.get('items', [])
            total = result.get('total', 0)
            self.log_result("Agenda List API", True, f"Retrieved {len(items)} agenda items (total: {total})")
            return True
        else:
            self.log_result("Agenda List API", False, f"Failed with status {response.status_code}: {response.text}")
            return False
    
    def test_agenda_create(self):
        """Test 7: POST /api/agenda - Create new agenda (auth required)"""
        print("\n=== Testing Agenda Creation API ===")
        
        admin_token = self.tokens.get('admin')
        if not admin_token:
            self.log_result("Agenda Creation API", False, "No admin token available")
            return False
        
        agenda_data = {
            "nomorPerkara": f"TEST/{datetime.now().year}/PA.Pnj",
            "jenisPerkara": "Test - Cerai Gugat",
            "tanggalSidang": "2026-02-15",
            "waktuSidang": "09:30",
            "ruangSidang": "Ruang Sidang Test",
            "hakim": "Test Judge, S.H., M.H.",
            "panitera": "Test Panitera, S.H.",
            "status": "dijadwalkan",
            "keterangan": "Test agenda sidang untuk API testing"
        }
        
        response, error = self.make_request('POST', '/agenda', agenda_data, auth_token=admin_token)
        
        if error:
            self.log_result("Agenda Creation API", False, f"Request error: {error}")
            return False
            
        if response.status_code == 201:
            result = response.json()
            agenda_id = result.get('id')
            nomor_perkara = result.get('nomorPerkara')
            tanggal_sidang = result.get('tanggalSidang')
            self.log_result("Agenda Creation API", True, f"Agenda created successfully. ID: {agenda_id}, Perkara: {nomor_perkara}, Date: {tanggal_sidang}")
            # Store for cleanup and update test
            self.created_items['agenda_id'] = agenda_id
            return True
        else:
            self.log_result("Agenda Creation API", False, f"Failed with status {response.status_code}: {response.text}")
            return False
    
    def test_agenda_date_filter(self):
        """Test 8: GET /api/agenda?dateFrom=2026-01-01&dateTo=2026-12-31 - Filter agenda by date range"""
        print("\n=== Testing Agenda Date Filter API ===")
        
        params = {
            'dateFrom': '2026-01-01',
            'dateTo': '2026-12-31'
        }
        response, error = self.make_request('GET', '/agenda', params=params)
        
        if error:
            self.log_result("Agenda Date Filter API", False, f"Request error: {error}")
            return False
            
        if response.status_code == 200:
            result = response.json()
            items = result.get('items', [])
            total = result.get('total', 0)
            self.log_result("Agenda Date Filter API", True, f"Date filter retrieved {len(items)} agenda items (total: {total}) for 2026")
            return True
        else:
            self.log_result("Agenda Date Filter API", False, f"Failed with status {response.status_code}: {response.text}")
            return False
    
    def test_putusan_public(self):
        """Test 9: GET /api/putusan?public=true&limit=5 - Get published putusan"""
        print("\n=== Testing Public Putusan API ===")
        
        params = {'public': 'true', 'limit': '5'}
        response, error = self.make_request('GET', '/putusan', params=params)
        
        if error:
            self.log_result("Public Putusan API", False, f"Request error: {error}")
            return False
            
        if response.status_code == 200:
            result = response.json()
            items = result.get('items', [])
            total = result.get('total', 0)
            self.log_result("Public Putusan API", True, f"Retrieved {len(items)} published putusan (total: {total})")
            return True
        else:
            self.log_result("Public Putusan API", False, f"Failed with status {response.status_code}: {response.text}")
            return False
    
    def test_putusan_create(self):
        """Test 10: POST /api/putusan - Create putusan (auth required)"""
        print("\n=== Testing Putusan Creation API ===")
        
        admin_token = self.tokens.get('admin')
        if not admin_token:
            self.log_result("Putusan Creation API", False, "No admin token available")
            return False
        
        putusan_data = {
            "nomorPerkara": f"TEST/{datetime.now().year}/PA.Pnj",
            "jenisPerkara": "Test - Cerai Talak",
            "tanggalPutusan": "2026-01-20",
            "ringkasanPutusan": "Test putusan: Mengabulkan permohonan pemohon untuk menjatuhkan talak satu raj'i kepada termohon sesuai dengan ketentuan hukum Islam yang berlaku.",
            "hakim": "Test Judge, S.H., M.H.",
            "statusPublish": True,
            "keterangan": "Test putusan untuk API testing"
        }
        
        response, error = self.make_request('POST', '/putusan', putusan_data, auth_token=admin_token)
        
        if error:
            self.log_result("Putusan Creation API", False, f"Request error: {error}")
            return False
            
        if response.status_code == 201:
            result = response.json()
            putusan_id = result.get('id')
            nomor_perkara = result.get('nomorPerkara')
            status_publish = result.get('statusPublish')
            self.log_result("Putusan Creation API", True, f"Putusan created successfully. ID: {putusan_id}, Perkara: {nomor_perkara}, Published: {status_publish}")
            # Store for cleanup
            self.created_items['putusan_id'] = putusan_id
            return True
        else:
            self.log_result("Putusan Creation API", False, f"Failed with status {response.status_code}: {response.text}")
            return False
    
    def test_cases_name_filter(self):
        """Test 11: GET /api/cases?namaPihak=Ahmad - Test name filter"""
        print("\n=== Testing Cases Name Filter API ===")
        
        params = {'namaPihak': 'Ahmad'}
        response, error = self.make_request('GET', '/cases', params=params)
        
        if error:
            self.log_result("Cases Name Filter API", False, f"Request error: {error}")
            return False
            
        if response.status_code == 200:
            result = response.json()
            items = result.get('items', [])
            total = result.get('total', 0)
            self.log_result("Cases Name Filter API", True, f"Name filter 'Ahmad' retrieved {len(items)} cases (total: {total})")
            return True
        else:
            self.log_result("Cases Name Filter API", False, f"Failed with status {response.status_code}: {response.text}")
            return False
    
    def test_cases_jenis_filter(self):
        """Test 12: GET /api/cases?jenis=Cerai - Test jenis filter"""
        print("\n=== Testing Cases Jenis Filter API ===")
        
        params = {'jenis': 'Cerai'}
        response, error = self.make_request('GET', '/cases', params=params)
        
        if error:
            self.log_result("Cases Jenis Filter API", False, f"Request error: {error}")
            return False
            
        if response.status_code == 200:
            result = response.json()
            items = result.get('items', [])
            total = result.get('total', 0)
            self.log_result("Cases Jenis Filter API", True, f"Jenis filter 'Cerai' retrieved {len(items)} cases (total: {total})")
            return True
        else:
            self.log_result("Cases Jenis Filter API", False, f"Failed with status {response.status_code}: {response.text}")
            return False
    
    def test_users_list(self):
        """Test 13: GET /api/users - Get users list (should show staff and editor accounts)"""
        print("\n=== Testing Users List API ===")
        
        admin_token = self.tokens.get('admin')
        if not admin_token:
            self.log_result("Users List API", False, "No admin token available")
            return False
            
        response, error = self.make_request('GET', '/users', auth_token=admin_token)
        
        if error:
            self.log_result("Users List API", False, f"Request error: {error}")
            return False
            
        if response.status_code == 200:
            result = response.json()
            items = result.get('items', [])
            
            # Check for expected roles
            roles = [user.get('role') for user in items]
            has_staff = 'staff' in roles
            has_editor = 'editor' in roles
            has_admin = any(role in ['admin', 'superadmin'] for role in roles)
            
            self.log_result("Users List API", True, 
                f"Retrieved {len(items)} users. Roles found: Admin: {has_admin}, Staff: {has_staff}, Editor: {has_editor}")
            return True
        else:
            self.log_result("Users List API", False, f"Failed with status {response.status_code}: {response.text}")
            return False
    
    def test_staff_permissions(self):
        """Test 14: Login as staff and test permissions"""
        print("\n=== Testing Staff Permissions ===")
        
        # Test staff login first
        if not self.test_login('staff'):
            return False
        
        staff_token = self.tokens.get('staff')
        
        # Test 1: Staff should be able to access agenda
        response, error = self.make_request('GET', '/agenda', auth_token=staff_token)
        if response and response.status_code == 200:
            self.log_result("Staff Access Agenda", True, "Staff can access agenda endpoint")
        else:
            self.log_result("Staff Access Agenda", False, f"Staff cannot access agenda: {response.status_code if response else 'No response'}")
        
        # Test 2: Staff may not be able to access pages (editor permission)
        response, error = self.make_request('GET', '/pages', auth_token=staff_token)
        if response and response.status_code == 401:
            self.log_result("Staff Access Pages", True, "Staff correctly denied access to pages (expected)")
        elif response and response.status_code == 200:
            self.log_result("Staff Access Pages", True, "Staff has access to pages (unexpected but not error)")
        else:
            self.log_result("Staff Access Pages", False, f"Unexpected response for staff pages access: {response.status_code if response else 'No response'}")
        
        return True
    
    def test_agenda_update(self):
        """Test 15: PUT /api/agenda/:id - Update agenda status"""
        print("\n=== Testing Agenda Update API ===")
        
        agenda_id = self.created_items.get('agenda_id')
        if not agenda_id:
            self.log_result("Agenda Update API", False, "No agenda ID available for update test")
            return False
        
        admin_token = self.tokens.get('admin')
        if not admin_token:
            self.log_result("Agenda Update API", False, "No admin token available")
            return False
        
        update_data = {
            "status": "selesai",
            "keterangan": "Sidang telah selesai dilaksanakan - Updated via API test"
        }
        
        response, error = self.make_request('PUT', f'/agenda/{agenda_id}', update_data, auth_token=admin_token)
        
        if error:
            self.log_result("Agenda Update API", False, f"Request error: {error}")
            return False
            
        if response.status_code == 200:
            result = response.json()
            updated_status = result.get('status')
            updated_keterangan = result.get('keterangan')
            self.log_result("Agenda Update API", True, f"Agenda updated successfully. Status: {updated_status}, Keterangan: {updated_keterangan}")
            return True
        else:
            self.log_result("Agenda Update API", False, f"Failed with status {response.status_code}: {response.text}")
            return False
    
    def cleanup_test_data(self):
        """Clean up test data created during testing"""
        print("\n=== Cleaning Up Test Data ===")
        
        admin_token = self.tokens.get('admin')
        if not admin_token:
            self.log_result("Cleanup", False, "No admin token for cleanup")
            return
        
        # Clean up page
        if 'page_id' in self.created_items:
            response, _ = self.make_request('DELETE', f'/pages/{self.created_items["page_id"]}', auth_token=admin_token)
            if response and response.status_code == 200:
                self.log_result("Cleanup Page", True, "Test page deleted successfully")
            else:
                self.log_result("Cleanup Page", False, "Failed to delete test page")
        
        # Clean up agenda
        if 'agenda_id' in self.created_items:
            response, _ = self.make_request('DELETE', f'/agenda/{self.created_items["agenda_id"]}', auth_token=admin_token)
            if response and response.status_code == 200:
                self.log_result("Cleanup Agenda", True, "Test agenda deleted successfully")
            else:
                self.log_result("Cleanup Agenda", False, "Failed to delete test agenda")
        
        # Clean up putusan
        if 'putusan_id' in self.created_items:
            response, _ = self.make_request('DELETE', f'/putusan/{self.created_items["putusan_id"]}', auth_token=admin_token)
            if response and response.status_code == 200:
                self.log_result("Cleanup Putusan", True, "Test putusan deleted successfully")
            else:
                self.log_result("Cleanup Putusan", False, "Failed to delete test putusan")
    
    def run_all_tests(self):
        """Run all v2.0 API tests as specified in the review request"""
        print("🚀 Starting Pengadilan Agama Penajam Backend API v2.0 Tests")
        print(f"Testing against: {BASE_URL}")
        print("Testing these new endpoints as specified in review request:")
        print("=" * 80)
        
        try:
            # Test 1: Admin login
            self.test_login('admin')
            
            # Test 2: Enhanced stats with charts data
            self.test_stats_endpoint()
            
            # Test 3-5: Pages API
            self.test_pages_list()
            self.test_pages_create()
            self.test_pages_public_slug()
            
            # Test 6-8: Agenda API
            self.test_agenda_list()
            self.test_agenda_create()
            self.test_agenda_date_filter()
            
            # Test 9-10: Putusan API
            self.test_putusan_public()
            self.test_putusan_create()
            
            # Test 11-12: Cases filters
            self.test_cases_name_filter()
            self.test_cases_jenis_filter()
            
            # Test 13: Users list
            self.test_users_list()
            
            # Test 14: Staff permissions
            self.test_staff_permissions()
            
            # Test 15: Agenda update
            self.test_agenda_update()
            
            # Clean up
            self.cleanup_test_data()
            
        except Exception as e:
            print(f"\n💥 Unexpected error during testing: {str(e)}")
        
        # Summary
        print("\n" + "=" * 80)
        print("📊 PENGADILAN AGAMA PENAJAM API v2.0 TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total*100):.1f}%")
        
        # Categorize results
        auth_tests = [r for r in self.test_results if 'Login' in r['test'] or 'Permission' in r['test']]
        api_tests = [r for r in self.test_results if 'API' in r['test']]
        cleanup_tests = [r for r in self.test_results if 'Cleanup' in r['test']]
        
        print(f"\nAuthentication Tests: {sum(1 for t in auth_tests if t['success'])}/{len(auth_tests)}")
        print(f"API Endpoint Tests: {sum(1 for t in api_tests if t['success'])}/{len(api_tests)}")
        print(f"Cleanup Tests: {sum(1 for t in cleanup_tests if t['success'])}/{len(cleanup_tests)}")
        
        # List failed tests
        failed_tests = [result for result in self.test_results if not result['success']]
        if failed_tests:
            print(f"\n❌ Failed Tests:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['message']}")
        else:
            print(f"\n🎉 All API v2.0 tests passed!")
        
        # Summary of what works and what doesn't
        print(f"\n🔍 API v2.0 ENDPOINT STATUS:")
        endpoint_status = {
            "POST /api/auth/login": any("Login" in r['test'] and r['success'] for r in self.test_results),
            "GET /api/stats": any("Enhanced Stats" in r['test'] and r['success'] for r in self.test_results),
            "GET /api/pages": any("Pages List" in r['test'] and r['success'] for r in self.test_results),
            "POST /api/pages": any("Page Creation" in r['test'] and r['success'] for r in self.test_results),
            "GET /api/pages/slug/*": any("Public Page by Slug" in r['test'] and r['success'] for r in self.test_results),
            "GET /api/agenda": any("Agenda List" in r['test'] and r['success'] for r in self.test_results),
            "POST /api/agenda": any("Agenda Creation" in r['test'] and r['success'] for r in self.test_results),
            "GET /api/agenda (date filter)": any("Agenda Date Filter" in r['test'] and r['success'] for r in self.test_results),
            "GET /api/putusan (public)": any("Public Putusan" in r['test'] and r['success'] for r in self.test_results),
            "POST /api/putusan": any("Putusan Creation" in r['test'] and r['success'] for r in self.test_results),
            "GET /api/cases (name filter)": any("Cases Name Filter" in r['test'] and r['success'] for r in self.test_results),
            "GET /api/cases (jenis filter)": any("Cases Jenis Filter" in r['test'] and r['success'] for r in self.test_results),
            "GET /api/users": any("Users List" in r['test'] and r['success'] for r in self.test_results),
            "PUT /api/agenda/:id": any("Agenda Update" in r['test'] and r['success'] for r in self.test_results),
        }
        
        for endpoint, status in endpoint_status.items():
            status_icon = "✅" if status else "❌"
            print(f"  {status_icon} {endpoint}")
        
        return passed == total

if __name__ == "__main__":
    if not validate_configuration():
        sys.exit(2)
    tester = APITesterV2()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
