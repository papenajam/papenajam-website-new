#!/usr/bin/env python3
"""
PostgreSQL/Prisma Cut-over Validation Test Suite
Testing all active API domains after external DB migration and seed.
"""

import requests
import json
import os
import sys
import io
from datetime import datetime, date

# Configuration
BASE_URL = "https://84064128-fabb-48b1-935a-cf6c2249cc0b.preview.emergentagent.com"
ADMIN_EMAIL = "admin@pa-penajam.go.id"
ADMIN_PASSWORD = "Admin@1234"
STAFF_EMAIL = "staff@pa-penajam.go.id"
STAFF_PASSWORD = "Staff@1234"
EDITOR_EMAIL = "editor@pa-penajam.go.id"
EDITOR_PASSWORD = "Editor@1234"
REQUEST_TIMEOUT_SECONDS = 15

class APITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.admin_token = None
        self.staff_token = None
        self.editor_token = None
        self.session = requests.Session()
        self.test_results = []
        self.created_ids = {
            'news': [],
            'page': [],
            'agenda': [],
            'putusan': [],
            'complaint': [],
            'survey': []
        }
        self.mongodb_references = []
        
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
    
    def check_mongodb_references(self, response_text, endpoint):
        """Check for MongoDB references in response"""
        mongo_keywords = ['mongodb', 'mongo', 'ObjectId', '_id', 'mongoose']
        found = []
        for keyword in mongo_keywords:
            if keyword.lower() in response_text.lower():
                found.append(keyword)
        if found:
            self.mongodb_references.append({
                'endpoint': endpoint,
                'keywords': found,
                'sample': response_text[:200]
            })
    
    def get_headers(self, auth_required=False, token=None):
        """Get request headers"""
        headers = {'Content-Type': 'application/json'}
        if auth_required:
            if token:
                headers['Authorization'] = f'Bearer {token}'
            elif self.admin_token:
                headers['Authorization'] = f'Bearer {self.admin_token}'
        return headers
    
    # ========== AUTHENTICATION TESTS ==========
    
    def test_admin_login(self):
        """Test admin login and JWT verification"""
        try:
            url = f"{self.base_url}/api/auth/login"
            data = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
            response = self.session.post(url, json=data, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                result = response.json()
                self.admin_token = result.get('token')
                user = result.get('user', {})
                self.check_mongodb_references(response.text, '/api/auth/login')
                self.log_test("Admin Login", True, 
                    f"User: {user.get('name')}, Role: {user.get('role')}, Email: {user.get('email')}")
                
                # Verify JWT
                verify_url = f"{self.base_url}/api/auth/verify"
                verify_response = self.session.get(verify_url, 
                    headers=self.get_headers(auth_required=True, token=self.admin_token),
                    timeout=REQUEST_TIMEOUT_SECONDS)
                
                if verify_response.status_code == 200:
                    self.log_test("Admin JWT Verify", True, "JWT token valid")
                    return True
                else:
                    self.log_test("Admin JWT Verify", False, f"Status: {verify_response.status_code}")
                    return False
            else:
                self.log_test("Admin Login", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Admin Login", False, f"Exception: {str(e)}")
            return False
    
    def test_staff_login(self):
        """Test staff login and JWT verification"""
        try:
            url = f"{self.base_url}/api/auth/login"
            data = {"email": STAFF_EMAIL, "password": STAFF_PASSWORD}
            response = self.session.post(url, json=data, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                result = response.json()
                self.staff_token = result.get('token')
                user = result.get('user', {})
                self.check_mongodb_references(response.text, '/api/auth/login (staff)')
                self.log_test("Staff Login", True, 
                    f"User: {user.get('name')}, Role: {user.get('role')}, Email: {user.get('email')}")
                
                # Verify JWT
                verify_url = f"{self.base_url}/api/auth/verify"
                verify_response = self.session.get(verify_url, 
                    headers=self.get_headers(auth_required=True, token=self.staff_token),
                    timeout=REQUEST_TIMEOUT_SECONDS)
                
                if verify_response.status_code == 200:
                    self.log_test("Staff JWT Verify", True, "JWT token valid")
                    return True
                else:
                    self.log_test("Staff JWT Verify", False, f"Status: {verify_response.status_code}")
                    return False
            else:
                self.log_test("Staff Login", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Staff Login", False, f"Exception: {str(e)}")
            return False
    
    def test_editor_login(self):
        """Test editor login and JWT verification"""
        try:
            url = f"{self.base_url}/api/auth/login"
            data = {"email": EDITOR_EMAIL, "password": EDITOR_PASSWORD}
            response = self.session.post(url, json=data, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                result = response.json()
                self.editor_token = result.get('token')
                user = result.get('user', {})
                self.check_mongodb_references(response.text, '/api/auth/login (editor)')
                self.log_test("Editor Login", True, 
                    f"User: {user.get('name')}, Role: {user.get('role')}, Email: {user.get('email')}")
                
                # Verify JWT
                verify_url = f"{self.base_url}/api/auth/verify"
                verify_response = self.session.get(verify_url, 
                    headers=self.get_headers(auth_required=True, token=self.editor_token),
                    timeout=REQUEST_TIMEOUT_SECONDS)
                
                if verify_response.status_code == 200:
                    self.log_test("Editor JWT Verify", True, "JWT token valid")
                    return True
                else:
                    self.log_test("Editor JWT Verify", False, f"Status: {verify_response.status_code}")
                    return False
            else:
                self.log_test("Editor Login", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Editor Login", False, f"Exception: {str(e)}")
            return False
    
    # ========== REPRESENTATIVE READ TESTS ==========
    
    def test_stats_api(self):
        """Test GET /api/stats"""
        try:
            url = f"{self.base_url}/api/stats"
            response = self.session.get(url, headers=self.get_headers(auth_required=True),
                timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                data = response.json()
                self.check_mongodb_references(response.text, '/api/stats')
                self.log_test("GET /api/stats", True, 
                    f"Stats retrieved with keys: {list(data.keys())[:5]}")
                return True
            else:
                self.log_test("GET /api/stats", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/stats", False, f"Exception: {str(e)}")
            return False
    
    def test_news_api(self):
        """Test GET /api/news"""
        try:
            url = f"{self.base_url}/api/news?public=true&limit=5"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.check_mongodb_references(response.text, '/api/news')
                self.log_test("GET /api/news", True, 
                    f"Retrieved {len(items)} news items, total: {data.get('total', 0)}")
                return True
            else:
                self.log_test("GET /api/news", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/news", False, f"Exception: {str(e)}")
            return False
    
    def test_announcements_api(self):
        """Test GET /api/announcements"""
        try:
            url = f"{self.base_url}/api/announcements?public=true&limit=5"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.check_mongodb_references(response.text, '/api/announcements')
                self.log_test("GET /api/announcements", True, 
                    f"Retrieved {len(items)} announcements, total: {data.get('total', 0)}")
                return True
            else:
                self.log_test("GET /api/announcements", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/announcements", False, f"Exception: {str(e)}")
            return False
    
    def test_services_api(self):
        """Test GET /api/services"""
        try:
            url = f"{self.base_url}/api/services"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.check_mongodb_references(response.text, '/api/services')
                self.log_test("GET /api/services", True, 
                    f"Retrieved {len(items)} services")
                return True
            else:
                self.log_test("GET /api/services", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/services", False, f"Exception: {str(e)}")
            return False
    
    def test_cases_api(self):
        """Test GET /api/cases"""
        try:
            url = f"{self.base_url}/api/cases?limit=5"
            response = self.session.get(url, headers=self.get_headers(auth_required=True),
                timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.check_mongodb_references(response.text, '/api/cases')
                self.log_test("GET /api/cases", True, 
                    f"Retrieved {len(items)} cases, total: {data.get('total', 0)}")
                return True
            else:
                self.log_test("GET /api/cases", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/cases", False, f"Exception: {str(e)}")
            return False
    
    def test_users_api(self):
        """Test GET /api/users (auth required)"""
        try:
            url = f"{self.base_url}/api/users"
            response = self.session.get(url, headers=self.get_headers(auth_required=True),
                timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.check_mongodb_references(response.text, '/api/users')
                self.log_test("GET /api/users", True, 
                    f"Retrieved {len(items)} users")
                return True
            else:
                self.log_test("GET /api/users", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/users", False, f"Exception: {str(e)}")
            return False
    
    def test_settings_api(self):
        """Test GET /api/settings"""
        try:
            url = f"{self.base_url}/api/settings"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                data = response.json()
                self.check_mongodb_references(response.text, '/api/settings')
                self.log_test("GET /api/settings", True, 
                    f"Settings retrieved with {len(data)} keys")
                return True
            else:
                self.log_test("GET /api/settings", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/settings", False, f"Exception: {str(e)}")
            return False
    
    def test_pages_api(self):
        """Test GET /api/pages"""
        try:
            url = f"{self.base_url}/api/pages"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.check_mongodb_references(response.text, '/api/pages')
                self.log_test("GET /api/pages", True, 
                    f"Retrieved {len(items)} pages")
                return True
            else:
                self.log_test("GET /api/pages", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/pages", False, f"Exception: {str(e)}")
            return False
    
    def test_pages_homepage_api(self):
        """Test GET /api/pages/slug/_homepage"""
        try:
            url = f"{self.base_url}/api/pages/slug/_homepage"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                data = response.json()
                blocks = data.get('blocks', [])
                self.check_mongodb_references(response.text, '/api/pages/slug/_homepage')
                self.log_test("GET /api/pages/slug/_homepage", True, 
                    f"Homepage retrieved with {len(blocks)} blocks, slug: {data.get('slug')}")
                return True
            else:
                self.log_test("GET /api/pages/slug/_homepage", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/pages/slug/_homepage", False, f"Exception: {str(e)}")
            return False
    
    def test_agenda_api(self):
        """Test GET /api/agenda"""
        try:
            url = f"{self.base_url}/api/agenda?limit=5"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.check_mongodb_references(response.text, '/api/agenda')
                self.log_test("GET /api/agenda", True, 
                    f"Retrieved {len(items)} agenda items, total: {data.get('total', 0)}")
                return True
            else:
                self.log_test("GET /api/agenda", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/agenda", False, f"Exception: {str(e)}")
            return False
    
    def test_putusan_api(self):
        """Test GET /api/putusan"""
        try:
            url = f"{self.base_url}/api/putusan?public=true&limit=5"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.check_mongodb_references(response.text, '/api/putusan')
                self.log_test("GET /api/putusan", True, 
                    f"Retrieved {len(items)} putusan items, total: {data.get('total', 0)}")
                return True
            else:
                self.log_test("GET /api/putusan", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/putusan", False, f"Exception: {str(e)}")
            return False
    
    def test_sidebar_widgets_api(self):
        """Test GET /api/sidebar-widgets"""
        try:
            url = f"{self.base_url}/api/sidebar-widgets"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.check_mongodb_references(response.text, '/api/sidebar-widgets')
                self.log_test("GET /api/sidebar-widgets", True, 
                    f"Retrieved {len(items)} sidebar widgets")
                return True
            else:
                self.log_test("GET /api/sidebar-widgets", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/sidebar-widgets", False, f"Exception: {str(e)}")
            return False
    
    def test_gallery_api(self):
        """Test GET /api/gallery"""
        try:
            url = f"{self.base_url}/api/gallery"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.check_mongodb_references(response.text, '/api/gallery')
                self.log_test("GET /api/gallery", True, 
                    f"Retrieved {len(items)} gallery items")
                return True
            else:
                self.log_test("GET /api/gallery", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/gallery", False, f"Exception: {str(e)}")
            return False
    
    def test_documents_api(self):
        """Test GET /api/documents"""
        try:
            url = f"{self.base_url}/api/documents"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.check_mongodb_references(response.text, '/api/documents')
                self.log_test("GET /api/documents", True, 
                    f"Retrieved {len(items)} documents")
                return True
            else:
                self.log_test("GET /api/documents", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/documents", False, f"Exception: {str(e)}")
            return False
    
    def test_faq_api(self):
        """Test GET /api/faq"""
        try:
            url = f"{self.base_url}/api/faq"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.check_mongodb_references(response.text, '/api/faq')
                self.log_test("GET /api/faq", True, 
                    f"Retrieved {len(items)} FAQ items")
                return True
            else:
                self.log_test("GET /api/faq", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/faq", False, f"Exception: {str(e)}")
            return False
    
    def test_banners_api(self):
        """Test GET /api/banners"""
        try:
            url = f"{self.base_url}/api/banners"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.check_mongodb_references(response.text, '/api/banners')
                self.log_test("GET /api/banners", True, 
                    f"Retrieved {len(items)} banners")
                return True
            else:
                self.log_test("GET /api/banners", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/banners", False, f"Exception: {str(e)}")
            return False
    
    def test_complaints_api(self):
        """Test GET /api/complaints (auth required)"""
        try:
            url = f"{self.base_url}/api/complaints"
            response = self.session.get(url, headers=self.get_headers(auth_required=True),
                timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.check_mongodb_references(response.text, '/api/complaints')
                self.log_test("GET /api/complaints (auth)", True, 
                    f"Retrieved {len(items)} complaints")
                return True
            else:
                self.log_test("GET /api/complaints (auth)", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/complaints (auth)", False, f"Exception: {str(e)}")
            return False
    
    def test_analytics_public_api(self):
        """Test POST /api/analytics/track (public)"""
        try:
            url = f"{self.base_url}/api/analytics/track"
            data = {"path": "/test-validation"}
            response = self.session.post(url, json=data, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                result = response.json()
                self.check_mongodb_references(response.text, '/api/analytics/track')
                self.log_test("POST /api/analytics/track (public)", True, 
                    f"Analytics tracked: {result.get('ok', False)}")
                return True
            else:
                self.log_test("POST /api/analytics/track (public)", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("POST /api/analytics/track (public)", False, f"Exception: {str(e)}")
            return False
    
    def test_analytics_auth_api(self):
        """Test GET /api/analytics (auth required)"""
        try:
            url = f"{self.base_url}/api/analytics"
            response = self.session.get(url, headers=self.get_headers(auth_required=True),
                timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                data = response.json()
                self.check_mongodb_references(response.text, '/api/analytics')
                self.log_test("GET /api/analytics (auth)", True, 
                    f"Analytics data: total views: {data.get('total', 0)}")
                return True
            else:
                self.log_test("GET /api/analytics (auth)", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/analytics (auth)", False, f"Exception: {str(e)}")
            return False
    
    def test_survey_config_api(self):
        """Test GET /api/surveys/config"""
        try:
            url = f"{self.base_url}/api/surveys/config"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                data = response.json()
                self.check_mongodb_references(response.text, '/api/surveys/config')
                self.log_test("GET /api/surveys/config", True, 
                    f"Survey config: {data.get('title', 'N/A')}, active: {data.get('isActive', False)}")
                return True
            else:
                self.log_test("GET /api/surveys/config", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/surveys/config", False, f"Exception: {str(e)}")
            return False
    
    def test_surveys_auth_api(self):
        """Test GET /api/surveys (auth required)"""
        try:
            url = f"{self.base_url}/api/surveys"
            response = self.session.get(url, headers=self.get_headers(auth_required=True),
                timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                data = response.json()
                self.check_mongodb_references(response.text, '/api/surveys')
                self.log_test("GET /api/surveys (auth)", True, 
                    f"Survey responses: {data.get('totalResponses', 0)}, avg rating: {data.get('averageRating', 0)}")
                return True
            else:
                self.log_test("GET /api/surveys (auth)", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/surveys (auth)", False, f"Exception: {str(e)}")
            return False
    
    def test_search_api(self):
        """Test GET /api/search"""
        try:
            url = f"{self.base_url}/api/search?q=pengadilan"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                data = response.json()
                results = data.get('results', [])
                self.check_mongodb_references(response.text, '/api/search')
                self.log_test("GET /api/search", True, 
                    f"Search results: {len(results)} items, total: {data.get('total', 0)}")
                return True
            else:
                self.log_test("GET /api/search", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/search", False, f"Exception: {str(e)}")
            return False
    
    def test_menus_api(self):
        """Test GET /api/menus"""
        try:
            url = f"{self.base_url}/api/menus"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.check_mongodb_references(response.text, '/api/menus')
                self.log_test("GET /api/menus", True, 
                    f"Retrieved {len(items)} menu items")
                return True
            else:
                self.log_test("GET /api/menus", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/menus", False, f"Exception: {str(e)}")
            return False
    
    def test_media_api(self):
        """Test GET /api/media"""
        try:
            url = f"{self.base_url}/api/media"
            response = self.session.get(url, headers=self.get_headers(auth_required=True),
                timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                self.check_mongodb_references(response.text, '/api/media')
                self.log_test("GET /api/media", True, 
                    f"Retrieved {len(items)} media items")
                return True
            else:
                self.log_test("GET /api/media", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /api/media", False, f"Exception: {str(e)}")
            return False
    
    # ========== CRUD TESTS ==========
    
    def test_news_crud(self):
        """Test News CRUD operations"""
        try:
            # CREATE
            url = f"{self.base_url}/api/news"
            create_data = {
                "title": "Test News PostgreSQL Validation",
                "content": "This is a test news article for PostgreSQL validation",
                "isPublished": True,
                "publishDate": date.today().isoformat()
            }
            response = self.session.post(url, json=create_data, 
                headers=self.get_headers(auth_required=True),
                timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code != 201:
                self.log_test("News CRUD - CREATE", False, f"Status: {response.status_code}")
                return False
            
            created = response.json()
            news_id = created.get('id')
            self.created_ids['news'].append(news_id)
            self.check_mongodb_references(response.text, '/api/news POST')
            self.log_test("News CRUD - CREATE", True, f"Created news ID: {news_id}")
            
            # READ
            read_url = f"{self.base_url}/api/news/{news_id}"
            read_response = self.session.get(read_url, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if read_response.status_code != 200:
                self.log_test("News CRUD - READ", False, f"Status: {read_response.status_code}")
                return False
            
            read_data = read_response.json()
            self.log_test("News CRUD - READ", True, f"Read news: {read_data.get('title')}")
            
            # UPDATE
            update_data = {
                "title": "Updated Test News PostgreSQL",
                "content": "Updated content"
            }
            update_response = self.session.put(read_url, json=update_data,
                headers=self.get_headers(auth_required=True),
                timeout=REQUEST_TIMEOUT_SECONDS)
            
            if update_response.status_code != 200:
                self.log_test("News CRUD - UPDATE", False, f"Status: {update_response.status_code}")
                return False
            
            updated = update_response.json()
            self.log_test("News CRUD - UPDATE", True, f"Updated title: {updated.get('title')}")
            
            # DELETE
            delete_response = self.session.delete(read_url,
                headers=self.get_headers(auth_required=True),
                timeout=REQUEST_TIMEOUT_SECONDS)
            
            if delete_response.status_code != 200:
                self.log_test("News CRUD - DELETE", False, f"Status: {delete_response.status_code}")
                return False
            
            self.created_ids['news'].remove(news_id)
            self.log_test("News CRUD - DELETE", True, "News deleted successfully")
            return True
            
        except Exception as e:
            self.log_test("News CRUD", False, f"Exception: {str(e)}")
            return False
    
    def test_page_crud(self):
        """Test Page CRUD operations"""
        try:
            # CREATE
            url = f"{self.base_url}/api/pages"
            create_data = {
                "title": "Test Page PostgreSQL",
                "slug": f"test-page-{datetime.now().timestamp()}",
                "blocks": [
                    {"type": "text", "content": "Test content"}
                ],
                "status": "published"
            }
            response = self.session.post(url, json=create_data,
                headers=self.get_headers(auth_required=True),
                timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code != 201:
                self.log_test("Page CRUD - CREATE", False, f"Status: {response.status_code}")
                return False
            
            created = response.json()
            page_id = created.get('id')
            self.created_ids['page'].append(page_id)
            self.check_mongodb_references(response.text, '/api/pages POST')
            self.log_test("Page CRUD - CREATE", True, f"Created page ID: {page_id}")
            
            # READ
            read_url = f"{self.base_url}/api/pages/{page_id}"
            read_response = self.session.get(read_url, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if read_response.status_code != 200:
                self.log_test("Page CRUD - READ", False, f"Status: {read_response.status_code}")
                return False
            
            read_data = read_response.json()
            self.log_test("Page CRUD - READ", True, f"Read page: {read_data.get('title')}")
            
            # UPDATE
            update_data = {
                "title": "Updated Test Page",
                "blocks": [
                    {"type": "text", "content": "Updated content"}
                ]
            }
            update_response = self.session.put(read_url, json=update_data,
                headers=self.get_headers(auth_required=True),
                timeout=REQUEST_TIMEOUT_SECONDS)
            
            if update_response.status_code != 200:
                self.log_test("Page CRUD - UPDATE", False, f"Status: {update_response.status_code}")
                return False
            
            updated = update_response.json()
            self.log_test("Page CRUD - UPDATE", True, f"Updated title: {updated.get('title')}")
            
            # DELETE
            delete_response = self.session.delete(read_url,
                headers=self.get_headers(auth_required=True),
                timeout=REQUEST_TIMEOUT_SECONDS)
            
            if delete_response.status_code != 200:
                self.log_test("Page CRUD - DELETE", False, f"Status: {delete_response.status_code}")
                return False
            
            self.created_ids['page'].remove(page_id)
            self.log_test("Page CRUD - DELETE", True, "Page deleted successfully")
            return True
            
        except Exception as e:
            self.log_test("Page CRUD", False, f"Exception: {str(e)}")
            return False
    
    def test_agenda_crud(self):
        """Test Agenda CRUD operations"""
        try:
            # CREATE
            url = f"{self.base_url}/api/agenda"
            create_data = {
                "nomorPerkara": "999/Pdt.G/2026/PA.Pnj",
                "tanggalSidang": date.today().isoformat(),
                "waktuSidang": "09:00",
                "ruangSidang": "Ruang 1",
                "jenisPerkara": "Cerai Gugat",
                "status": "scheduled"
            }
            response = self.session.post(url, json=create_data,
                headers=self.get_headers(auth_required=True),
                timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code != 201:
                self.log_test("Agenda CRUD - CREATE", False, f"Status: {response.status_code}")
                return False
            
            created = response.json()
            agenda_id = created.get('id')
            self.created_ids['agenda'].append(agenda_id)
            self.check_mongodb_references(response.text, '/api/agenda POST')
            self.log_test("Agenda CRUD - CREATE", True, f"Created agenda ID: {agenda_id}")
            
            # READ
            read_url = f"{self.base_url}/api/agenda/{agenda_id}"
            read_response = self.session.get(read_url, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if read_response.status_code != 200:
                self.log_test("Agenda CRUD - READ", False, f"Status: {read_response.status_code}")
                return False
            
            read_data = read_response.json()
            self.log_test("Agenda CRUD - READ", True, f"Read agenda: {read_data.get('nomorPerkara')}")
            
            # UPDATE
            update_data = {
                "status": "completed",
                "waktuSidang": "10:00"
            }
            update_response = self.session.put(read_url, json=update_data,
                headers=self.get_headers(auth_required=True),
                timeout=REQUEST_TIMEOUT_SECONDS)
            
            if update_response.status_code != 200:
                self.log_test("Agenda CRUD - UPDATE", False, f"Status: {update_response.status_code}")
                return False
            
            updated = update_response.json()
            self.log_test("Agenda CRUD - UPDATE", True, f"Updated status: {updated.get('status')}")
            
            # DELETE
            delete_response = self.session.delete(read_url,
                headers=self.get_headers(auth_required=True),
                timeout=REQUEST_TIMEOUT_SECONDS)
            
            if delete_response.status_code != 200:
                self.log_test("Agenda CRUD - DELETE", False, f"Status: {delete_response.status_code}")
                return False
            
            self.created_ids['agenda'].remove(agenda_id)
            self.log_test("Agenda CRUD - DELETE", True, "Agenda deleted successfully")
            return True
            
        except Exception as e:
            self.log_test("Agenda CRUD", False, f"Exception: {str(e)}")
            return False
    
    def test_putusan_crud(self):
        """Test Putusan CRUD operations"""
        try:
            # CREATE
            url = f"{self.base_url}/api/putusan"
            create_data = {
                "nomorPerkara": "999/Pdt.G/2026/PA.Pnj",
                "tanggalPutusan": date.today().isoformat(),
                "jenisPerkara": "Cerai Gugat",
                "statusPublish": True,
                "filePutusan": "/uploads/pdfs/test.pdf"
            }
            response = self.session.post(url, json=create_data,
                headers=self.get_headers(auth_required=True),
                timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code != 201:
                self.log_test("Putusan CRUD - CREATE", False, f"Status: {response.status_code}")
                return False
            
            created = response.json()
            putusan_id = created.get('id')
            self.created_ids['putusan'].append(putusan_id)
            self.check_mongodb_references(response.text, '/api/putusan POST')
            self.log_test("Putusan CRUD - CREATE", True, f"Created putusan ID: {putusan_id}")
            
            # READ
            read_url = f"{self.base_url}/api/putusan/{putusan_id}"
            read_response = self.session.get(read_url, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if read_response.status_code != 200:
                self.log_test("Putusan CRUD - READ", False, f"Status: {read_response.status_code}")
                return False
            
            read_data = read_response.json()
            self.log_test("Putusan CRUD - READ", True, f"Read putusan: {read_data.get('nomorPerkara')}")
            
            # UPDATE
            update_data = {
                "statusPublish": False
            }
            update_response = self.session.put(read_url, json=update_data,
                headers=self.get_headers(auth_required=True),
                timeout=REQUEST_TIMEOUT_SECONDS)
            
            if update_response.status_code != 200:
                self.log_test("Putusan CRUD - UPDATE", False, f"Status: {update_response.status_code}")
                return False
            
            updated = update_response.json()
            self.log_test("Putusan CRUD - UPDATE", True, f"Updated statusPublish: {updated.get('statusPublish')}")
            
            # DELETE
            delete_response = self.session.delete(read_url,
                headers=self.get_headers(auth_required=True),
                timeout=REQUEST_TIMEOUT_SECONDS)
            
            if delete_response.status_code != 200:
                self.log_test("Putusan CRUD - DELETE", False, f"Status: {delete_response.status_code}")
                return False
            
            self.created_ids['putusan'].remove(putusan_id)
            self.log_test("Putusan CRUD - DELETE", True, "Putusan deleted successfully")
            return True
            
        except Exception as e:
            self.log_test("Putusan CRUD", False, f"Exception: {str(e)}")
            return False
    
    def test_complaint_crud(self):
        """Test Complaint CRUD operations"""
        try:
            # CREATE
            url = f"{self.base_url}/api/complaints"
            create_data = {
                "name": "Test Complainant",
                "email": "test@example.com",
                "phone": "081234567890",
                "message": "Test complaint for PostgreSQL validation"
            }
            response = self.session.post(url, json=create_data,
                timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code != 201:
                self.log_test("Complaint CRUD - CREATE", False, f"Status: {response.status_code}")
                return False
            
            created = response.json()
            complaint_id = created.get('id')
            self.created_ids['complaint'].append(complaint_id)
            self.check_mongodb_references(response.text, '/api/complaints POST')
            self.log_test("Complaint CRUD - CREATE", True, f"Created complaint ID: {complaint_id}")
            
            # READ (auth required)
            read_url = f"{self.base_url}/api/complaints/{complaint_id}"
            read_response = self.session.get(read_url,
                headers=self.get_headers(auth_required=True),
                timeout=REQUEST_TIMEOUT_SECONDS)
            
            if read_response.status_code != 200:
                self.log_test("Complaint CRUD - READ", False, f"Status: {read_response.status_code}")
                return False
            
            read_data = read_response.json()
            self.log_test("Complaint CRUD - READ", True, f"Read complaint: {read_data.get('name')}")
            
            # UPDATE (status change)
            update_url = f"{self.base_url}/api/complaints/{complaint_id}"
            update_data = {
                "status": "resolved"
            }
            update_response = self.session.put(update_url, json=update_data,
                headers=self.get_headers(auth_required=True),
                timeout=REQUEST_TIMEOUT_SECONDS)
            
            if update_response.status_code != 200:
                self.log_test("Complaint CRUD - UPDATE", False, f"Status: {update_response.status_code}")
                return False
            
            updated = update_response.json()
            self.log_test("Complaint CRUD - UPDATE", True, f"Updated status: {updated.get('status')}")
            
            # DELETE
            delete_response = self.session.delete(update_url,
                headers=self.get_headers(auth_required=True),
                timeout=REQUEST_TIMEOUT_SECONDS)
            
            if delete_response.status_code != 200:
                self.log_test("Complaint CRUD - DELETE", False, f"Status: {delete_response.status_code}")
                return False
            
            self.created_ids['complaint'].remove(complaint_id)
            self.log_test("Complaint CRUD - DELETE", True, "Complaint deleted successfully")
            return True
            
        except Exception as e:
            self.log_test("Complaint CRUD", False, f"Exception: {str(e)}")
            return False
    
    def test_survey_submit(self):
        """Test Survey submission"""
        try:
            url = f"{self.base_url}/api/surveys/submit"
            data = {
                "rating": 5,
                "comment": "Excellent service - PostgreSQL validation test"
            }
            response = self.session.post(url, json=data, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                result = response.json()
                self.check_mongodb_references(response.text, '/api/surveys/submit')
                self.log_test("Survey Submit", True, f"Survey submitted: {result.get('message')}")
                return True
            else:
                self.log_test("Survey Submit", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Survey Submit", False, f"Exception: {str(e)}")
            return False
    
    def test_settings_update(self):
        """Test Settings update"""
        try:
            url = f"{self.base_url}/api/settings"
            
            # First get current settings
            get_response = self.session.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
            if get_response.status_code != 200:
                self.log_test("Settings Update - GET", False, f"Status: {get_response.status_code}")
                return False
            
            current = get_response.json()
            
            # Update a setting
            update_data = {
                "court_name": current.get('court_name', 'Pengadilan Agama Penajam')
            }
            update_response = self.session.put(url, json=update_data,
                headers=self.get_headers(auth_required=True),
                timeout=REQUEST_TIMEOUT_SECONDS)
            
            if update_response.status_code == 200:
                result = update_response.json()
                self.check_mongodb_references(update_response.text, '/api/settings PUT')
                self.log_test("Settings Update", True, "Settings updated successfully")
                return True
            else:
                self.log_test("Settings Update", False, f"Status: {update_response.status_code}")
                return False
        except Exception as e:
            self.log_test("Settings Update", False, f"Exception: {str(e)}")
            return False
    
    def test_upload_api(self):
        """Test file upload API"""
        try:
            url = f"{self.base_url}/api/upload"
            
            # Create a small test image file
            files = {
                'file': ('test.txt', io.BytesIO(b'Test file content'), 'text/plain')
            }
            
            response = self.session.post(url, files=files,
                headers={'Authorization': f'Bearer {self.admin_token}'},
                timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                result = response.json()
                file_url = result.get('url', '')
                self.check_mongodb_references(response.text, '/api/upload')
                self.log_test("Upload API", True, f"File uploaded: {file_url}")
                return True
            else:
                self.log_test("Upload API", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Upload API", False, f"Exception: {str(e)}")
            return False
    
    # ========== SECURITY TESTS ==========
    
    def test_unauthorized_access(self):
        """Test unauthorized access to protected endpoint"""
        try:
            url = f"{self.base_url}/api/users"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 401:
                self.log_test("Unauthorized Access Test", True, 
                    "Protected endpoint correctly returns 401 without auth")
                return True
            else:
                self.log_test("Unauthorized Access Test", False, 
                    f"Expected 401, got {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Unauthorized Access Test", False, f"Exception: {str(e)}")
            return False
    
    def test_404_route(self):
        """Test unknown route returns 404"""
        try:
            url = f"{self.base_url}/api/nonexistent-route-test"
            response = self.session.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 404:
                self.log_test("404 Route Test", True, 
                    "Unknown route correctly returns 404")
                return True
            else:
                self.log_test("404 Route Test", False, 
                    f"Expected 404, got {response.status_code}")
                return False
        except Exception as e:
            self.log_test("404 Route Test", False, f"Exception: {str(e)}")
            return False
    
    # ========== MAIN TEST RUNNER ==========
    
    def run_all_tests(self):
        """Run all validation tests"""
        print("=" * 80)
        print("POSTGRESQL/PRISMA CUT-OVER VALIDATION TEST SUITE")
        print("=" * 80)
        print(f"Base URL: {self.base_url}")
        print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 80)
        
        # Phase 1: Authentication
        print("\n" + "=" * 80)
        print("PHASE 1: AUTHENTICATION & JWT VERIFICATION")
        print("=" * 80)
        
        if not self.test_admin_login():
            print("❌ Cannot proceed without admin authentication")
            return False
        
        self.test_staff_login()
        self.test_editor_login()
        
        # Phase 2: Representative Reads
        print("\n" + "=" * 80)
        print("PHASE 2: REPRESENTATIVE READ TESTS FOR ALL API DOMAINS")
        print("=" * 80)
        
        read_tests = [
            self.test_stats_api,
            self.test_news_api,
            self.test_announcements_api,
            self.test_services_api,
            self.test_cases_api,
            self.test_users_api,
            self.test_settings_api,
            self.test_pages_api,
            self.test_pages_homepage_api,
            self.test_agenda_api,
            self.test_putusan_api,
            self.test_sidebar_widgets_api,
            self.test_gallery_api,
            self.test_documents_api,
            self.test_faq_api,
            self.test_banners_api,
            self.test_complaints_api,
            self.test_analytics_public_api,
            self.test_analytics_auth_api,
            self.test_survey_config_api,
            self.test_surveys_auth_api,
            self.test_search_api,
            self.test_menus_api,
            self.test_media_api,
        ]
        
        for test in read_tests:
            test()
        
        # Phase 3: CRUD Operations
        print("\n" + "=" * 80)
        print("PHASE 3: CRUD/ROUND TRIP TESTS")
        print("=" * 80)
        
        crud_tests = [
            self.test_news_crud,
            self.test_page_crud,
            self.test_agenda_crud,
            self.test_putusan_crud,
            self.test_complaint_crud,
            self.test_survey_submit,
            self.test_settings_update,
            self.test_upload_api,
        ]
        
        for test in crud_tests:
            test()
        
        # Phase 4: Security Tests
        print("\n" + "=" * 80)
        print("PHASE 4: SECURITY & ERROR HANDLING TESTS")
        print("=" * 80)
        
        self.test_unauthorized_access()
        self.test_404_route()
        
        # Summary
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total*100):.1f}%")
        
        # MongoDB References Check
        print("\n" + "=" * 80)
        print("MONGODB DEPENDENCY CHECK")
        print("=" * 80)
        
        if self.mongodb_references:
            print(f"⚠️  WARNING: Found {len(self.mongodb_references)} potential MongoDB references:")
            for ref in self.mongodb_references[:5]:  # Show first 5
                print(f"  - Endpoint: {ref['endpoint']}")
                print(f"    Keywords: {', '.join(ref['keywords'])}")
        else:
            print("✅ No MongoDB references found in API responses")
        
        print("\n" + "=" * 80)
        print("DETAILED RESULTS")
        print("=" * 80)
        
        for result in self.test_results:
            print(f"{result['status']}: {result['test']}")
            if result['details']:
                print(f"   {result['details']}")
        
        print("\n" + "=" * 80)
        print("RECOMMENDATION")
        print("=" * 80)
        
        if passed == total and not self.mongodb_references:
            print("✅ ALL TESTS PASSED")
            print("✅ NO MONGODB DEPENDENCIES DETECTED")
            print("✅ SAFE TO REMOVE LEGACY MONGODB SCRIPTS/DEPENDENCY/DOCS/TESTS")
        elif passed == total:
            print("✅ ALL TESTS PASSED")
            print("⚠️  MONGODB REFERENCES DETECTED - REVIEW BEFORE REMOVAL")
        else:
            print("❌ SOME TESTS FAILED")
            print("❌ NOT SAFE TO REMOVE MONGODB TOOLING UNTIL ALL TESTS PASS")
        
        print("=" * 80)
        return passed == total

if __name__ == "__main__":
    tester = APITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
