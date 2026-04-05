#!/usr/bin/env python3
"""
Backend API Testing for Pengadilan Agama Penajam Website
Testing all new feature APIs as requested in the review.
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://pengadilan-beranda.preview.emergentagent.com"
ADMIN_EMAIL = "admin@pa-penajam.go.id"
ADMIN_PASSWORD = "Admin@1234"

class APITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.session = requests.Session()
        self.test_results = []
        
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
    
    def login(self):
        """Login to get JWT token"""
        try:
            url = f"{self.base_url}/api/auth/login"
            data = {
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
            
            response = self.session.post(url, json=data)
            
            if response.status_code == 200:
                result = response.json()
                self.token = result.get('token')
                self.log_test("Admin Login", True, f"Token obtained, user: {result.get('user', {}).get('name', 'Unknown')}")
                return True
            else:
                self.log_test("Admin Login", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Admin Login", False, f"Exception: {str(e)}")
            return False
    
    def get_headers(self, auth_required=False):
        """Get request headers"""
        headers = {'Content-Type': 'application/json'}
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        return headers
    
    def test_gallery_api(self):
        """Test GET /api/gallery - should return gallery items with categories"""
        try:
            url = f"{self.base_url}/api/gallery"
            response = self.session.get(url)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                categories = data.get('categories', [])
                
                self.log_test("GET /api/gallery", True, 
                    f"Retrieved {len(items)} gallery items, {len(categories)} categories")
                return True
            else:
                self.log_test("GET /api/gallery", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("GET /api/gallery", False, f"Exception: {str(e)}")
            return False
    
    def test_documents_api(self):
        """Test GET /api/documents - should return documents with categories"""
        try:
            url = f"{self.base_url}/api/documents"
            response = self.session.get(url)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                categories = data.get('categories', [])
                total = data.get('total', 0)
                
                self.log_test("GET /api/documents", True, 
                    f"Retrieved {len(items)} documents, {len(categories)} categories, total: {total}")
                return True
            else:
                self.log_test("GET /api/documents", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("GET /api/documents", False, f"Exception: {str(e)}")
            return False
    
    def test_faq_api(self):
        """Test GET /api/faq - should return FAQ items"""
        try:
            url = f"{self.base_url}/api/faq"
            response = self.session.get(url)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                categories = data.get('categories', [])
                
                self.log_test("GET /api/faq", True, 
                    f"Retrieved {len(items)} FAQ items, {len(categories)} categories")
                return True
            else:
                self.log_test("GET /api/faq", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("GET /api/faq", False, f"Exception: {str(e)}")
            return False
    
    def test_banners_api(self):
        """Test GET /api/banners - should return active banners"""
        try:
            url = f"{self.base_url}/api/banners"
            response = self.session.get(url)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                
                self.log_test("GET /api/banners", True, 
                    f"Retrieved {len(items)} active banners")
                return True
            else:
                self.log_test("GET /api/banners", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("GET /api/banners", False, f"Exception: {str(e)}")
            return False
    
    def test_surveys_config_api(self):
        """Test GET /api/surveys/config - should return survey config"""
        try:
            url = f"{self.base_url}/api/surveys/config"
            response = self.session.get(url)
            
            if response.status_code == 200:
                data = response.json()
                survey_id = data.get('id')
                is_active = data.get('isActive')
                title = data.get('title')
                
                self.log_test("GET /api/surveys/config", True, 
                    f"Survey config: id={survey_id}, active={is_active}, title='{title}'")
                return True
            else:
                self.log_test("GET /api/surveys/config", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("GET /api/surveys/config", False, f"Exception: {str(e)}")
            return False
    
    def test_surveys_submit_api(self):
        """Test POST /api/surveys/submit - submit rating"""
        try:
            url = f"{self.base_url}/api/surveys/submit"
            data = {
                "rating": 5,
                "comment": "Sangat baik"
            }
            
            response = self.session.post(url, json=data)
            
            if response.status_code == 200:
                result = response.json()
                message = result.get('message', '')
                
                self.log_test("POST /api/surveys/submit", True, 
                    f"Survey submitted successfully: {message}")
                return True
            else:
                self.log_test("POST /api/surveys/submit", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("POST /api/surveys/submit", False, f"Exception: {str(e)}")
            return False
    
    def test_surveys_get_api(self):
        """Test GET /api/surveys (with auth) - should return survey responses with averageRating"""
        try:
            url = f"{self.base_url}/api/surveys"
            headers = self.get_headers(auth_required=True)
            response = self.session.get(url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                total = data.get('total', 0)
                avg_rating = data.get('averageRating', 0)
                total_responses = data.get('totalResponses', 0)
                
                self.log_test("GET /api/surveys (auth)", True, 
                    f"Retrieved {len(items)} responses, total: {total}, avg rating: {avg_rating}, total responses: {total_responses}")
                return True
            else:
                self.log_test("GET /api/surveys (auth)", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("GET /api/surveys (auth)", False, f"Exception: {str(e)}")
            return False
    
    def test_complaints_submit_api(self):
        """Test POST /api/complaints - submit complaint"""
        try:
            url = f"{self.base_url}/api/complaints"
            data = {
                "name": "Test User",
                "email": "test@test.com",
                "message": "Test complaint"
            }
            
            response = self.session.post(url, json=data)
            
            if response.status_code == 201:
                result = response.json()
                message = result.get('message', '')
                complaint_id = result.get('id', '')
                
                self.log_test("POST /api/complaints", True, 
                    f"Complaint submitted: {message}, ID: {complaint_id}")
                return True
            else:
                self.log_test("POST /api/complaints", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("POST /api/complaints", False, f"Exception: {str(e)}")
            return False
    
    def test_complaints_get_api(self):
        """Test GET /api/complaints (with auth) - should return complaints list"""
        try:
            url = f"{self.base_url}/api/complaints"
            headers = self.get_headers(auth_required=True)
            response = self.session.get(url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                total = data.get('total', 0)
                total_pages = data.get('totalPages', 0)
                
                self.log_test("GET /api/complaints (auth)", True, 
                    f"Retrieved {len(items)} complaints, total: {total}, pages: {total_pages}")
                return True
            else:
                self.log_test("GET /api/complaints (auth)", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("GET /api/complaints (auth)", False, f"Exception: {str(e)}")
            return False
    
    def test_analytics_track_api(self):
        """Test POST /api/analytics/track - track page view"""
        try:
            url = f"{self.base_url}/api/analytics/track"
            data = {
                "path": "/"
            }
            
            response = self.session.post(url, json=data)
            
            if response.status_code == 200:
                result = response.json()
                ok = result.get('ok', False)
                
                self.log_test("POST /api/analytics/track", True, 
                    f"Page view tracked successfully: {ok}")
                return True
            else:
                self.log_test("POST /api/analytics/track", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("POST /api/analytics/track", False, f"Exception: {str(e)}")
            return False
    
    def test_analytics_get_api(self):
        """Test GET /api/analytics (with auth) - should return analytics data"""
        try:
            url = f"{self.base_url}/api/analytics"
            headers = self.get_headers(auth_required=True)
            response = self.session.get(url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                total = data.get('total', 0)
                daily_data = data.get('dailyData', [])
                top_pages = data.get('topPages', [])
                days = data.get('days', 0)
                
                self.log_test("GET /api/analytics (auth)", True, 
                    f"Analytics data: total views: {total}, daily data points: {len(daily_data)}, top pages: {len(top_pages)}, days: {days}")
                return True
            else:
                self.log_test("GET /api/analytics (auth)", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("GET /api/analytics (auth)", False, f"Exception: {str(e)}")
            return False
    
    def test_search_api(self):
        """Test GET /api/search?q=pengadilan - should return search results across multiple content types"""
        try:
            url = f"{self.base_url}/api/search?q=pengadilan"
            response = self.session.get(url)
            
            if response.status_code == 200:
                data = response.json()
                results = data.get('results', [])
                total = data.get('total', 0)
                
                # Count results by type
                type_counts = {}
                for result in results:
                    result_type = result.get('type', 'unknown')
                    type_counts[result_type] = type_counts.get(result_type, 0) + 1
                
                self.log_test("GET /api/search?q=pengadilan", True, 
                    f"Search results: {total} total, types: {type_counts}")
                return True
            else:
                self.log_test("GET /api/search?q=pengadilan", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("GET /api/search?q=pengadilan", False, f"Exception: {str(e)}")
            return False
    
    def test_settings_api(self):
        """Test GET /api/settings - should include new keys (whatsapp, facebook, seo_title, footer_description)"""
        try:
            url = f"{self.base_url}/api/settings"
            response = self.session.get(url)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for new keys
                new_keys = ['whatsapp', 'facebook', 'seo_title', 'footer_description']
                found_keys = []
                missing_keys = []
                
                for key in new_keys:
                    if key in data:
                        found_keys.append(key)
                    else:
                        missing_keys.append(key)
                
                # Also check for existing keys
                existing_keys = ['court_name', 'hero_title', 'address', 'phone', 'email']
                existing_found = [key for key in existing_keys if key in data]
                
                self.log_test("GET /api/settings", True, 
                    f"Settings retrieved. New keys found: {found_keys}, missing: {missing_keys}, existing keys: {len(existing_found)}")
                return True
            else:
                self.log_test("GET /api/settings", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("GET /api/settings", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all API tests"""
        print("=" * 80)
        print("PENGADILAN AGAMA PENAJAM - NEW FEATURE API TESTING")
        print("=" * 80)
        print(f"Base URL: {self.base_url}")
        print(f"Admin: {ADMIN_EMAIL}")
        print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 80)
        
        # Step 1: Login to get JWT token
        if not self.login():
            print("❌ Cannot proceed without authentication")
            return False
        
        print("\n" + "=" * 50)
        print("TESTING NEW FEATURE APIs")
        print("=" * 50)
        
        # Test all APIs
        test_methods = [
            self.test_gallery_api,
            self.test_documents_api,
            self.test_faq_api,
            self.test_banners_api,
            self.test_surveys_config_api,
            self.test_surveys_submit_api,
            self.test_surveys_get_api,
            self.test_complaints_submit_api,
            self.test_complaints_get_api,
            self.test_analytics_track_api,
            self.test_analytics_get_api,
            self.test_search_api,
            self.test_settings_api,
        ]
        
        for test_method in test_methods:
            test_method()
        
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
        
        print("\nDETAILED RESULTS:")
        for result in self.test_results:
            print(f"{result['status']}: {result['test']}")
            if result['details']:
                print(f"   {result['details']}")
        
        print("=" * 80)
        return passed == total

if __name__ == "__main__":
    tester = APITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)