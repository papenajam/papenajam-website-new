#!/usr/bin/env python3
"""
PostgreSQL/Prisma Migration Audit Test
======================================
Verifies that all active API routes work with PostgreSQL/Prisma
and do NOT require MongoDB after the database cut-over.

Test Scope:
1. Authentication (login/verify)
2. Representative reads for all active domains
3. Safe CRUD operations with cleanup
4. Unauthorized access handling
5. Unknown route handling (404)
6. Verify no MongoDB errors appear
"""

import requests
import json
import sys
from datetime import datetime, timedelta
import uuid

# Configuration
BASE_URL = "https://84064128-fabb-48b1-935a-cf6c2249cc0b.preview.emergentagent.com"
ADMIN_EMAIL = "admin@pa-penajam.go.id"
ADMIN_PASSWORD = "Admin@1234"
STAFF_EMAIL = "staff@pa-penajam.go.id"
STAFF_PASSWORD = "Staff@1234"
EDITOR_EMAIL = "editor@pa-penajam.go.id"
EDITOR_PASSWORD = "Editor@1234"
REQUEST_TIMEOUT = 15

class PostgresAuditTester:
    def __init__(self):
        self.base_url = BASE_URL.rstrip("/")
        self.token = None
        self.session = requests.Session()
        self.test_results = []
        self.created_resources = []  # Track resources for cleanup
        self.mongodb_errors = []  # Track any MongoDB-related errors
        
    def log_test(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            'test': test_name,
            'status': status,
            'success': success,
            'details': details
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
            
    def check_for_mongodb_errors(self, response_text, test_name):
        """Check if response contains MongoDB-related errors"""
        mongodb_keywords = ['mongodb', 'mongo', 'MongoError', 'MongoClient', 'mongoose']
        lower_text = response_text.lower()
        for keyword in mongodb_keywords:
            if keyword in lower_text:
                error_msg = f"MongoDB reference found in {test_name}: {keyword}"
                self.mongodb_errors.append(error_msg)
                print(f"⚠️  WARNING: {error_msg}")
                return True
        return False
    
    def get_headers(self, auth_required=False):
        """Get request headers"""
        headers = {'Content-Type': 'application/json'}
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        return headers
    
    # ========================================================================
    # AUTHENTICATION TESTS
    # ========================================================================
    
    def test_login(self):
        """Test POST /api/auth/login"""
        try:
            url = f"{self.base_url}/api/auth/login"
            data = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
            
            response = self.session.post(url, json=data, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "Login")
            
            if response.status_code == 200:
                result = response.json()
                self.token = result.get('token')
                user = result.get('user', {})
                self.log_test("POST /api/auth/login", True, 
                    f"Admin login successful, role: {user.get('role')}")
                return True
            else:
                self.log_test("POST /api/auth/login", False, 
                    f"Status: {response.status_code}, Response: {response.text[:200]}")
                return False
        except Exception as e:
            self.log_test("POST /api/auth/login", False, f"Exception: {str(e)}")
            return False
    
    def test_verify_token(self):
        """Test GET /api/auth/verify"""
        try:
            url = f"{self.base_url}/api/auth/verify"
            headers = self.get_headers(auth_required=True)
            
            response = self.session.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "Verify Token")
            
            if response.status_code == 200:
                result = response.json()
                user = result.get('user', {})
                self.log_test("GET /api/auth/verify", True, 
                    f"Token valid, user: {user.get('email')}")
                return True
            else:
                self.log_test("GET /api/auth/verify", False, 
                    f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/auth/verify", False, f"Exception: {str(e)}")
            return False
    
    def test_unauthorized_access(self):
        """Test protected endpoint without auth token"""
        try:
            url = f"{self.base_url}/api/stats"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT)
            
            if response.status_code == 401:
                self.log_test("Unauthorized Access (401)", True, 
                    "Protected endpoint correctly returns 401 without token")
                return True
            else:
                self.log_test("Unauthorized Access (401)", False, 
                    f"Expected 401, got {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Unauthorized Access (401)", False, f"Exception: {str(e)}")
            return False
    
    def test_unknown_route(self):
        """Test unknown route returns 404"""
        try:
            url = f"{self.base_url}/api/nonexistent-route-{uuid.uuid4()}"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT)
            
            if response.status_code == 404:
                self.log_test("Unknown Route (404)", True, 
                    "Unknown route correctly returns 404")
                return True
            else:
                self.log_test("Unknown Route (404)", False, 
                    f"Expected 404, got {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Unknown Route (404)", False, f"Exception: {str(e)}")
            return False
    
    # ========================================================================
    # READ TESTS - All Active Domains
    # ========================================================================
    
    def test_stats_api(self):
        """Test GET /api/stats"""
        try:
            url = f"{self.base_url}/api/stats"
            headers = self.get_headers(auth_required=True)
            
            response = self.session.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "Stats API")
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("GET /api/stats", True, 
                    f"Stats retrieved: monthlyData, caseTypes, totalAgenda={data.get('totalAgenda', 0)}")
                return True
            else:
                self.log_test("GET /api/stats", False, 
                    f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/stats", False, f"Exception: {str(e)}")
            return False
    
    def test_news_api(self):
        """Test GET /api/news"""
        try:
            url = f"{self.base_url}/api/news?public=true&limit=5"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "News API")
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.log_test("GET /api/news", True, 
                    f"Retrieved {len(items)} news items")
                return True
            else:
                self.log_test("GET /api/news", False, 
                    f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/news", False, f"Exception: {str(e)}")
            return False
    
    def test_announcements_api(self):
        """Test GET /api/announcements"""
        try:
            url = f"{self.base_url}/api/announcements?public=true&limit=5"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "Announcements API")
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.log_test("GET /api/announcements", True, 
                    f"Retrieved {len(items)} announcements")
                return True
            else:
                self.log_test("GET /api/announcements", False, 
                    f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/announcements", False, f"Exception: {str(e)}")
            return False
    
    def test_services_api(self):
        """Test GET /api/services"""
        try:
            url = f"{self.base_url}/api/services"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "Services API")
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.log_test("GET /api/services", True, 
                    f"Retrieved {len(items)} services")
                return True
            else:
                self.log_test("GET /api/services", False, 
                    f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/services", False, f"Exception: {str(e)}")
            return False
    
    def test_cases_api(self):
        """Test GET /api/cases"""
        try:
            url = f"{self.base_url}/api/cases?limit=5"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "Cases API")
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.log_test("GET /api/cases", True, 
                    f"Retrieved {len(items)} cases")
                return True
            else:
                self.log_test("GET /api/cases", False, 
                    f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/cases", False, f"Exception: {str(e)}")
            return False
    
    def test_users_api(self):
        """Test GET /api/users (auth required)"""
        try:
            url = f"{self.base_url}/api/users"
            headers = self.get_headers(auth_required=True)
            
            response = self.session.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "Users API")
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.log_test("GET /api/users", True, 
                    f"Retrieved {len(items)} users")
                return True
            else:
                self.log_test("GET /api/users", False, 
                    f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/users", False, f"Exception: {str(e)}")
            return False
    
    def test_settings_api(self):
        """Test GET /api/settings"""
        try:
            url = f"{self.base_url}/api/settings"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "Settings API")
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("GET /api/settings", True, 
                    f"Retrieved {len(data)} settings")
                return True
            else:
                self.log_test("GET /api/settings", False, 
                    f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/settings", False, f"Exception: {str(e)}")
            return False
    
    def test_pages_api(self):
        """Test GET /api/pages"""
        try:
            url = f"{self.base_url}/api/pages"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "Pages API")
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.log_test("GET /api/pages", True, 
                    f"Retrieved {len(items)} pages")
                return True
            else:
                self.log_test("GET /api/pages", False, 
                    f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/pages", False, f"Exception: {str(e)}")
            return False
    
    def test_homepage_api(self):
        """Test GET /api/pages/slug/_homepage"""
        try:
            url = f"{self.base_url}/api/pages/slug/_homepage"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "Homepage API")
            
            if response.status_code == 200:
                data = response.json()
                blocks = data.get('blocks', [])
                self.log_test("GET /api/pages/slug/_homepage", True, 
                    f"Homepage retrieved with {len(blocks)} blocks")
                return True
            else:
                self.log_test("GET /api/pages/slug/_homepage", False, 
                    f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/pages/slug/_homepage", False, f"Exception: {str(e)}")
            return False
    
    def test_agenda_api(self):
        """Test GET /api/agenda"""
        try:
            url = f"{self.base_url}/api/agenda?limit=5"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "Agenda API")
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.log_test("GET /api/agenda", True, 
                    f"Retrieved {len(items)} agenda items")
                return True
            else:
                self.log_test("GET /api/agenda", False, 
                    f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/agenda", False, f"Exception: {str(e)}")
            return False
    
    def test_putusan_api(self):
        """Test GET /api/putusan"""
        try:
            url = f"{self.base_url}/api/putusan?public=true&limit=5"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "Putusan API")
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.log_test("GET /api/putusan", True, 
                    f"Retrieved {len(items)} putusan items")
                return True
            else:
                self.log_test("GET /api/putusan", False, 
                    f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/putusan", False, f"Exception: {str(e)}")
            return False
    
    def test_sidebar_widgets_api(self):
        """Test GET /api/sidebar-widgets"""
        try:
            url = f"{self.base_url}/api/sidebar-widgets"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "Sidebar Widgets API")
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.log_test("GET /api/sidebar-widgets", True, 
                    f"Retrieved {len(items)} sidebar widgets")
                return True
            else:
                self.log_test("GET /api/sidebar-widgets", False, 
                    f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/sidebar-widgets", False, f"Exception: {str(e)}")
            return False
    
    def test_gallery_api(self):
        """Test GET /api/gallery"""
        try:
            url = f"{self.base_url}/api/gallery"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "Gallery API")
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.log_test("GET /api/gallery", True, 
                    f"Retrieved {len(items)} gallery items")
                return True
            else:
                self.log_test("GET /api/gallery", False, 
                    f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/gallery", False, f"Exception: {str(e)}")
            return False
    
    def test_documents_api(self):
        """Test GET /api/documents"""
        try:
            url = f"{self.base_url}/api/documents"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "Documents API")
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.log_test("GET /api/documents", True, 
                    f"Retrieved {len(items)} documents")
                return True
            else:
                self.log_test("GET /api/documents", False, 
                    f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/documents", False, f"Exception: {str(e)}")
            return False
    
    def test_faq_api(self):
        """Test GET /api/faq"""
        try:
            url = f"{self.base_url}/api/faq"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "FAQ API")
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.log_test("GET /api/faq", True, 
                    f"Retrieved {len(items)} FAQ items")
                return True
            else:
                self.log_test("GET /api/faq", False, 
                    f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/faq", False, f"Exception: {str(e)}")
            return False
    
    def test_banners_api(self):
        """Test GET /api/banners"""
        try:
            url = f"{self.base_url}/api/banners"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "Banners API")
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.log_test("GET /api/banners", True, 
                    f"Retrieved {len(items)} banners")
                return True
            else:
                self.log_test("GET /api/banners", False, 
                    f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/banners", False, f"Exception: {str(e)}")
            return False
    
    def test_complaints_api(self):
        """Test GET /api/complaints (auth required)"""
        try:
            url = f"{self.base_url}/api/complaints"
            headers = self.get_headers(auth_required=True)
            
            response = self.session.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "Complaints API")
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.log_test("GET /api/complaints (auth)", True, 
                    f"Retrieved {len(items)} complaints")
                return True
            else:
                self.log_test("GET /api/complaints (auth)", False, 
                    f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/complaints (auth)", False, f"Exception: {str(e)}")
            return False
    
    def test_analytics_public_api(self):
        """Test POST /api/analytics/track (public)"""
        try:
            url = f"{self.base_url}/api/analytics/track"
            data = {"path": "/test-audit", "userAgent": "PostgresAuditTest"}
            
            response = self.session.post(url, json=data, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "Analytics Track API")
            
            if response.status_code == 200:
                self.log_test("POST /api/analytics/track (public)", True, 
                    "Page view tracked successfully")
                return True
            else:
                self.log_test("POST /api/analytics/track (public)", False, 
                    f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("POST /api/analytics/track (public)", False, f"Exception: {str(e)}")
            return False
    
    def test_analytics_auth_api(self):
        """Test GET /api/analytics (auth required)"""
        try:
            url = f"{self.base_url}/api/analytics"
            headers = self.get_headers(auth_required=True)
            
            response = self.session.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "Analytics API")
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("GET /api/analytics (auth)", True, 
                    f"Analytics data retrieved: totalViews={data.get('totalViews', 0)}")
                return True
            else:
                self.log_test("GET /api/analytics (auth)", False, 
                    f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/analytics (auth)", False, f"Exception: {str(e)}")
            return False
    
    def test_surveys_config_api(self):
        """Test GET /api/surveys/config"""
        try:
            url = f"{self.base_url}/api/surveys/config"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "Surveys Config API")
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("GET /api/surveys/config", True, 
                    f"Survey config retrieved: {data.get('title', 'N/A')}")
                return True
            else:
                self.log_test("GET /api/surveys/config", False, 
                    f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/surveys/config", False, f"Exception: {str(e)}")
            return False
    
    def test_surveys_auth_api(self):
        """Test GET /api/surveys (auth required)"""
        try:
            url = f"{self.base_url}/api/surveys"
            headers = self.get_headers(auth_required=True)
            
            response = self.session.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "Surveys API")
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("GET /api/surveys (auth)", True, 
                    f"Survey responses retrieved: count={data.get('count', 0)}")
                return True
            else:
                self.log_test("GET /api/surveys (auth)", False, 
                    f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/surveys (auth)", False, f"Exception: {str(e)}")
            return False
    
    def test_search_api(self):
        """Test GET /api/search"""
        try:
            url = f"{self.base_url}/api/search?q=pengadilan"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "Search API")
            
            if response.status_code == 200:
                data = response.json()
                results = data.get('results', [])
                self.log_test("GET /api/search", True, 
                    f"Search returned {len(results)} results")
                return True
            else:
                self.log_test("GET /api/search", False, 
                    f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/search", False, f"Exception: {str(e)}")
            return False
    
    def test_menus_api(self):
        """Test GET /api/menus"""
        try:
            url = f"{self.base_url}/api/menus"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "Menus API")
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.log_test("GET /api/menus", True, 
                    f"Retrieved {len(items)} menu items")
                return True
            else:
                self.log_test("GET /api/menus", False, 
                    f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/menus", False, f"Exception: {str(e)}")
            return False
    
    def test_media_api(self):
        """Test GET /api/media (auth required)"""
        try:
            url = f"{self.base_url}/api/media?limit=5"
            headers = self.get_headers(auth_required=True)
            
            response = self.session.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(response.text, "Media API")
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.log_test("GET /api/media (auth)", True, 
                    f"Retrieved {len(items)} media items")
                return True
            else:
                self.log_test("GET /api/media (auth)", False, 
                    f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/media (auth)", False, f"Exception: {str(e)}")
            return False
    
    # ========================================================================
    # CRUD TESTS - Safe operations with cleanup
    # ========================================================================
    
    def test_crud_news(self):
        """Test CRUD operations on News"""
        try:
            headers = self.get_headers(auth_required=True)
            
            # CREATE
            create_url = f"{self.base_url}/api/news"
            news_data = {
                "title": f"Test News PostgreSQL Audit {uuid.uuid4()}",
                "content": "This is a test news item created during PostgreSQL audit",
                "isPublished": False,
                "author": "Audit Tester"
            }
            
            create_response = self.session.post(create_url, json=news_data, 
                                               headers=headers, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(create_response.text, "News CREATE")
            
            if create_response.status_code != 200:
                self.log_test("CRUD News - CREATE", False, 
                    f"Create failed: {create_response.status_code}")
                return False
            
            created_news = create_response.json()
            news_id = created_news.get('id')
            self.created_resources.append(('news', news_id))
            
            # READ
            read_url = f"{self.base_url}/api/news/{news_id}"
            read_response = self.session.get(read_url, headers=headers, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(read_response.text, "News READ")
            
            if read_response.status_code != 200:
                self.log_test("CRUD News - READ", False, 
                    f"Read failed: {read_response.status_code}")
                return False
            
            # UPDATE
            update_data = {"title": f"Updated Test News {uuid.uuid4()}"}
            update_response = self.session.put(read_url, json=update_data, 
                                              headers=headers, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(update_response.text, "News UPDATE")
            
            if update_response.status_code != 200:
                self.log_test("CRUD News - UPDATE", False, 
                    f"Update failed: {update_response.status_code}")
                return False
            
            # DELETE
            delete_response = self.session.delete(read_url, headers=headers, 
                                                 timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(delete_response.text, "News DELETE")
            
            if delete_response.status_code == 200:
                self.created_resources.remove(('news', news_id))
                self.log_test("CRUD News (CREATE/READ/UPDATE/DELETE)", True, 
                    "All CRUD operations successful")
                return True
            else:
                self.log_test("CRUD News - DELETE", False, 
                    f"Delete failed: {delete_response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("CRUD News", False, f"Exception: {str(e)}")
            return False
    
    def test_crud_agenda(self):
        """Test CRUD operations on Agenda"""
        try:
            headers = self.get_headers(auth_required=True)
            
            # CREATE
            create_url = f"{self.base_url}/api/agenda"
            tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
            agenda_data = {
                "nomorPerkara": f"TEST/{uuid.uuid4().hex[:8]}/2026",
                "jenisPerkara": "Test Audit",
                "tanggalSidang": tomorrow,
                "waktuSidang": "10:00",
                "ruangSidang": "Test Room",
                "status": "Terjadwal"
            }
            
            create_response = self.session.post(create_url, json=agenda_data, 
                                               headers=headers, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(create_response.text, "Agenda CREATE")
            
            if create_response.status_code != 200:
                self.log_test("CRUD Agenda - CREATE", False, 
                    f"Create failed: {create_response.status_code}")
                return False
            
            created_agenda = create_response.json()
            agenda_id = created_agenda.get('id')
            self.created_resources.append(('agenda', agenda_id))
            
            # READ
            read_url = f"{self.base_url}/api/agenda/{agenda_id}"
            read_response = self.session.get(read_url, headers=headers, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(read_response.text, "Agenda READ")
            
            if read_response.status_code != 200:
                self.log_test("CRUD Agenda - READ", False, 
                    f"Read failed: {read_response.status_code}")
                return False
            
            # UPDATE
            update_data = {"status": "Selesai"}
            update_response = self.session.put(read_url, json=update_data, 
                                              headers=headers, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(update_response.text, "Agenda UPDATE")
            
            if update_response.status_code != 200:
                self.log_test("CRUD Agenda - UPDATE", False, 
                    f"Update failed: {update_response.status_code}")
                return False
            
            # DELETE
            delete_response = self.session.delete(read_url, headers=headers, 
                                                 timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(delete_response.text, "Agenda DELETE")
            
            if delete_response.status_code == 200:
                self.created_resources.remove(('agenda', agenda_id))
                self.log_test("CRUD Agenda (CREATE/READ/UPDATE/DELETE)", True, 
                    "All CRUD operations successful")
                return True
            else:
                self.log_test("CRUD Agenda - DELETE", False, 
                    f"Delete failed: {delete_response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("CRUD Agenda", False, f"Exception: {str(e)}")
            return False
    
    def test_crud_putusan(self):
        """Test CRUD operations on Putusan"""
        try:
            headers = self.get_headers(auth_required=True)
            
            # CREATE
            create_url = f"{self.base_url}/api/putusan"
            putusan_data = {
                "nomorPerkara": f"TEST/{uuid.uuid4().hex[:8]}/2026",
                "jenisPerkara": "Test Audit",
                "tanggalPutusan": datetime.now().strftime('%Y-%m-%d'),
                "ringkasanPutusan": "Test putusan for PostgreSQL audit",
                "statusPublish": False
            }
            
            create_response = self.session.post(create_url, json=putusan_data, 
                                               headers=headers, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(create_response.text, "Putusan CREATE")
            
            if create_response.status_code != 200:
                self.log_test("CRUD Putusan - CREATE", False, 
                    f"Create failed: {create_response.status_code}")
                return False
            
            created_putusan = create_response.json()
            putusan_id = created_putusan.get('id')
            self.created_resources.append(('putusan', putusan_id))
            
            # READ
            read_url = f"{self.base_url}/api/putusan/{putusan_id}"
            read_response = self.session.get(read_url, headers=headers, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(read_response.text, "Putusan READ")
            
            if read_response.status_code != 200:
                self.log_test("CRUD Putusan - READ", False, 
                    f"Read failed: {read_response.status_code}")
                return False
            
            # UPDATE
            update_data = {"ringkasanPutusan": "Updated test putusan"}
            update_response = self.session.put(read_url, json=update_data, 
                                              headers=headers, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(update_response.text, "Putusan UPDATE")
            
            if update_response.status_code != 200:
                self.log_test("CRUD Putusan - UPDATE", False, 
                    f"Update failed: {update_response.status_code}")
                return False
            
            # DELETE
            delete_response = self.session.delete(read_url, headers=headers, 
                                                 timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(delete_response.text, "Putusan DELETE")
            
            if delete_response.status_code == 200:
                self.created_resources.remove(('putusan', putusan_id))
                self.log_test("CRUD Putusan (CREATE/READ/UPDATE/DELETE)", True, 
                    "All CRUD operations successful")
                return True
            else:
                self.log_test("CRUD Putusan - DELETE", False, 
                    f"Delete failed: {delete_response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("CRUD Putusan", False, f"Exception: {str(e)}")
            return False
    
    def test_crud_page(self):
        """Test CRUD operations on Page"""
        try:
            headers = self.get_headers(auth_required=True)
            
            # CREATE
            create_url = f"{self.base_url}/api/pages"
            page_data = {
                "title": f"Test Page {uuid.uuid4()}",
                "slug": f"test-page-{uuid.uuid4().hex[:8]}",
                "status": "draft",
                "blocks": [
                    {"id": str(uuid.uuid4()), "type": "text", "content": "Test content"}
                ]
            }
            
            create_response = self.session.post(create_url, json=page_data, 
                                               headers=headers, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(create_response.text, "Page CREATE")
            
            if create_response.status_code != 200:
                self.log_test("CRUD Page - CREATE", False, 
                    f"Create failed: {create_response.status_code}")
                return False
            
            created_page = create_response.json()
            page_id = created_page.get('id')
            self.created_resources.append(('pages', page_id))
            
            # READ
            read_url = f"{self.base_url}/api/pages/{page_id}"
            read_response = self.session.get(read_url, headers=headers, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(read_response.text, "Page READ")
            
            if read_response.status_code != 200:
                self.log_test("CRUD Page - READ", False, 
                    f"Read failed: {read_response.status_code}")
                return False
            
            # UPDATE
            update_data = {"title": f"Updated Test Page {uuid.uuid4()}"}
            update_response = self.session.put(read_url, json=update_data, 
                                              headers=headers, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(update_response.text, "Page UPDATE")
            
            if update_response.status_code != 200:
                self.log_test("CRUD Page - UPDATE", False, 
                    f"Update failed: {update_response.status_code}")
                return False
            
            # DELETE
            delete_response = self.session.delete(read_url, headers=headers, 
                                                 timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(delete_response.text, "Page DELETE")
            
            if delete_response.status_code == 200:
                self.created_resources.remove(('pages', page_id))
                self.log_test("CRUD Page (CREATE/READ/UPDATE/DELETE)", True, 
                    "All CRUD operations successful")
                return True
            else:
                self.log_test("CRUD Page - DELETE", False, 
                    f"Delete failed: {delete_response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("CRUD Page", False, f"Exception: {str(e)}")
            return False
    
    def test_crud_settings(self):
        """Test UPDATE operation on Settings"""
        try:
            headers = self.get_headers(auth_required=True)
            
            # READ current settings
            read_url = f"{self.base_url}/api/settings"
            read_response = self.session.get(read_url, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(read_response.text, "Settings READ")
            
            if read_response.status_code != 200:
                self.log_test("CRUD Settings - READ", False, 
                    f"Read failed: {read_response.status_code}")
                return False
            
            original_settings = read_response.json()
            
            # UPDATE (add a test setting)
            update_url = f"{self.base_url}/api/settings"
            test_key = f"test_audit_{uuid.uuid4().hex[:8]}"
            update_data = {test_key: "PostgreSQL Audit Test Value"}
            
            update_response = self.session.put(update_url, json=update_data, 
                                              headers=headers, timeout=REQUEST_TIMEOUT)
            self.check_for_mongodb_errors(update_response.text, "Settings UPDATE")
            
            if update_response.status_code != 200:
                self.log_test("CRUD Settings - UPDATE", False, 
                    f"Update failed: {update_response.status_code}")
                return False
            
            # VERIFY update
            verify_response = self.session.get(read_url, timeout=REQUEST_TIMEOUT)
            if verify_response.status_code == 200:
                updated_settings = verify_response.json()
                if test_key in updated_settings:
                    self.log_test("CRUD Settings (READ/UPDATE/VERIFY)", True, 
                        "Settings update successful")
                    return True
                else:
                    self.log_test("CRUD Settings - VERIFY", False, 
                        "Updated setting not found")
                    return False
            else:
                self.log_test("CRUD Settings - VERIFY", False, 
                    f"Verify failed: {verify_response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("CRUD Settings", False, f"Exception: {str(e)}")
            return False
    
    # ========================================================================
    # CLEANUP
    # ========================================================================
    
    def cleanup_resources(self):
        """Clean up any resources created during testing"""
        if not self.created_resources:
            print("\n✅ No resources to clean up")
            return
        
        print(f"\n🧹 Cleaning up {len(self.created_resources)} test resources...")
        headers = self.get_headers(auth_required=True)
        
        for resource_type, resource_id in self.created_resources[:]:
            try:
                url = f"{self.base_url}/api/{resource_type}/{resource_id}"
                response = self.session.delete(url, headers=headers, timeout=REQUEST_TIMEOUT)
                if response.status_code == 200:
                    print(f"   ✅ Deleted {resource_type}/{resource_id}")
                    self.created_resources.remove((resource_type, resource_id))
                else:
                    print(f"   ⚠️  Failed to delete {resource_type}/{resource_id}: {response.status_code}")
            except Exception as e:
                print(f"   ❌ Error deleting {resource_type}/{resource_id}: {str(e)}")
    
    # ========================================================================
    # MAIN TEST RUNNER
    # ========================================================================
    
    def run_all_tests(self):
        """Run all PostgreSQL audit tests"""
        print("=" * 80)
        print("PostgreSQL/Prisma Migration Audit Test")
        print("=" * 80)
        print(f"Base URL: {self.base_url}")
        print(f"Admin Email: {ADMIN_EMAIL}")
        print("=" * 80)
        print()
        
        # Authentication Tests
        print("🔐 AUTHENTICATION TESTS")
        print("-" * 80)
        if not self.test_login():
            print("\n❌ Login failed - cannot continue with authenticated tests")
            return False
        self.test_verify_token()
        self.test_unauthorized_access()
        self.test_unknown_route()
        print()
        
        # Read Tests - All Active Domains
        print("📖 READ TESTS - All Active Domains")
        print("-" * 80)
        self.test_stats_api()
        self.test_news_api()
        self.test_announcements_api()
        self.test_services_api()
        self.test_cases_api()
        self.test_users_api()
        self.test_settings_api()
        self.test_pages_api()
        self.test_homepage_api()
        self.test_agenda_api()
        self.test_putusan_api()
        self.test_sidebar_widgets_api()
        self.test_gallery_api()
        self.test_documents_api()
        self.test_faq_api()
        self.test_banners_api()
        self.test_complaints_api()
        self.test_analytics_public_api()
        self.test_analytics_auth_api()
        self.test_surveys_config_api()
        self.test_surveys_auth_api()
        self.test_search_api()
        self.test_menus_api()
        self.test_media_api()
        print()
        
        # CRUD Tests
        print("✏️  CRUD TESTS - Safe operations with cleanup")
        print("-" * 80)
        self.test_crud_news()
        self.test_crud_agenda()
        self.test_crud_putusan()
        self.test_crud_page()
        self.test_crud_settings()
        print()
        
        # Cleanup
        self.cleanup_resources()
        print()
        
        # Summary
        print("=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for r in self.test_results if r['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        print()
        
        if self.mongodb_errors:
            print("⚠️  MONGODB REFERENCES DETECTED:")
            print("-" * 80)
            for error in self.mongodb_errors:
                print(f"   {error}")
            print()
        else:
            print("✅ NO MONGODB REFERENCES DETECTED")
            print()
        
        if failed_tests > 0:
            print("❌ FAILED TESTS:")
            print("-" * 80)
            for result in self.test_results:
                if not result['success']:
                    print(f"   {result['test']}")
                    if result['details']:
                        print(f"      {result['details']}")
            print()
        
        print("=" * 80)
        print("AUDIT CONCLUSION")
        print("=" * 80)
        
        if failed_tests == 0 and not self.mongodb_errors:
            print("✅ PASS: All API routes are working with PostgreSQL/Prisma")
            print("✅ PASS: No MongoDB dependencies detected")
            print("✅ SAFE TO REMOVE: Legacy MongoDB tooling can be removed")
            return True
        elif self.mongodb_errors:
            print("⚠️  WARNING: MongoDB references detected in responses")
            print("❌ NOT SAFE: Review MongoDB dependencies before removal")
            return False
        else:
            print(f"❌ FAIL: {failed_tests} test(s) failed")
            print("❌ NOT SAFE: Fix failing tests before removing MongoDB tooling")
            return False

def main():
    """Main entry point"""
    tester = PostgresAuditTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
