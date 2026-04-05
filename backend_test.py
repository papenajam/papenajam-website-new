#!/usr/bin/env python3
"""
Homepage Builder API Testing Script
Tests the specific endpoints requested for the Pengadilan Agama Penajam website
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://pengadilan-beranda.preview.emergentagent.com"
ADMIN_EMAIL = "admin@pa-penajam.go.id"
ADMIN_PASSWORD = "Admin@1234"

class HomepageBuilderTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details,
            'timestamp': datetime.now().isoformat()
        })
        print(f"{status} {test_name}")
        if details:
            print(f"    Details: {details}")
        print()

    def authenticate(self):
        """Login and get JWT token"""
        try:
            print("🔐 Authenticating admin user...")
            response = requests.post(
                f"{self.base_url}/api/auth/login",
                json={
                    "email": ADMIN_EMAIL,
                    "password": ADMIN_PASSWORD
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('token')
                user = data.get('user', {})
                self.log_test(
                    "Admin Authentication", 
                    True, 
                    f"Logged in as {user.get('name')} ({user.get('role')})"
                )
                return True
            else:
                self.log_test(
                    "Admin Authentication", 
                    False, 
                    f"Status: {response.status_code}, Response: {response.text}"
                )
                return False
                
        except Exception as e:
            self.log_test("Admin Authentication", False, f"Exception: {str(e)}")
            return False

    def get_auth_headers(self):
        """Get headers with JWT token"""
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.token}"
        }

    def test_get_homepage_initial(self):
        """Test 1: GET /api/pages/slug/_homepage - Should return 200 with configured homepage blocks"""
        try:
            print("📄 Testing GET /api/pages/slug/_homepage (initial)...")
            response = requests.get(f"{self.base_url}/api/pages/slug/_homepage")
            
            if response.status_code == 200:
                data = response.json()
                blocks = data.get('blocks', [])
                slug = data.get('slug')
                
                # Check if it's the homepage
                if slug == '_homepage':
                    self.log_test(
                        "GET Homepage (Initial)", 
                        True, 
                        f"Found homepage with {len(blocks)} blocks. Blocks: {[b.get('type') for b in blocks]}"
                    )
                    return data
                else:
                    self.log_test(
                        "GET Homepage (Initial)", 
                        False, 
                        f"Expected slug '_homepage', got '{slug}'"
                    )
                    return None
            elif response.status_code == 404:
                # Homepage doesn't exist yet, this is acceptable
                self.log_test(
                    "GET Homepage (Initial)", 
                    True, 
                    "Homepage not found (404) - will be created during testing"
                )
                return None
            else:
                self.log_test(
                    "GET Homepage (Initial)", 
                    False, 
                    f"Status: {response.status_code}, Response: {response.text}"
                )
                return None
                
        except Exception as e:
            self.log_test("GET Homepage (Initial)", False, f"Exception: {str(e)}")
            return None

    def test_create_test_page(self):
        """Test 2: POST /api/pages - Create a test page"""
        try:
            print("📝 Testing POST /api/pages (create test page)...")
            
            test_page_data = {
                "title": "Test API Verify Page",
                "slug": "test-api-verify",
                "blocks": [],
                "status": "published"
            }
            
            response = requests.post(
                f"{self.base_url}/api/pages",
                json=test_page_data,
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 201:
                data = response.json()
                page_id = data.get('id')
                self.log_test(
                    "POST Create Test Page", 
                    True, 
                    f"Created page with ID: {page_id}, slug: {data.get('slug')}"
                )
                return data
            else:
                self.log_test(
                    "POST Create Test Page", 
                    False, 
                    f"Status: {response.status_code}, Response: {response.text}"
                )
                return None
                
        except Exception as e:
            self.log_test("POST Create Test Page", False, f"Exception: {str(e)}")
            return None

    def test_create_or_update_homepage(self):
        """Test 3: Create or update homepage with blocks"""
        try:
            print("🏠 Testing homepage creation/update...")
            
            # First, check if homepage exists
            existing_homepage = self.test_get_homepage_initial()
            
            homepage_blocks = [
                {
                    "id": "hero-home-1",
                    "type": "hero_home",
                    "settings": {
                        "title": "Pengadilan Agama Penajam - API Test",
                        "subtitle": "Testing Homepage Builder API",
                        "backgroundImage": "https://images.unsplash.com/photo-1667849921481-9e13c239ee3d?w=1400&q=80",
                        "buttonText": "Lihat Layanan",
                        "buttonLink": "#layanan"
                    }
                },
                {
                    "id": "services-grid-1",
                    "type": "services_grid",
                    "settings": {
                        "title": "Layanan Kami",
                        "subtitle": "Pelayanan terbaik untuk masyarakat"
                    }
                },
                {
                    "id": "news-ann-1",
                    "type": "news_ann",
                    "settings": {
                        "newsTitle": "Berita Terkini",
                        "announcementTitle": "Pengumuman"
                    }
                },
                {
                    "id": "case-search-1",
                    "type": "case_search",
                    "settings": {
                        "title": "Pencarian Perkara",
                        "subtitle": "Cari informasi perkara Anda"
                    }
                },
                {
                    "id": "profile-cards-1",
                    "type": "profile_cards",
                    "settings": {
                        "title": "Profil Pengadilan"
                    }
                },
                {
                    "id": "contact-info-1",
                    "type": "contact_info",
                    "settings": {
                        "title": "Hubungi Kami"
                    }
                }
            ]
            
            if existing_homepage:
                # Update existing homepage
                homepage_id = existing_homepage.get('id')
                update_data = {
                    "title": "Homepage - Updated via API",
                    "blocks": homepage_blocks,
                    "status": "published"
                }
                
                response = requests.put(
                    f"{self.base_url}/api/pages/{homepage_id}",
                    json=update_data,
                    headers=self.get_auth_headers()
                )
                
                if response.status_code == 200:
                    data = response.json()
                    self.log_test(
                        "PUT Update Homepage", 
                        True, 
                        f"Updated homepage with {len(homepage_blocks)} blocks"
                    )
                    return data
                else:
                    self.log_test(
                        "PUT Update Homepage", 
                        False, 
                        f"Status: {response.status_code}, Response: {response.text}"
                    )
                    return None
            else:
                # Create new homepage
                homepage_data = {
                    "title": "Homepage - Created via API",
                    "slug": "_homepage",
                    "blocks": homepage_blocks,
                    "status": "published"
                }
                
                response = requests.post(
                    f"{self.base_url}/api/pages",
                    json=homepage_data,
                    headers=self.get_auth_headers()
                )
                
                if response.status_code == 201:
                    data = response.json()
                    self.log_test(
                        "POST Create Homepage", 
                        True, 
                        f"Created homepage with {len(homepage_blocks)} blocks"
                    )
                    return data
                else:
                    self.log_test(
                        "POST Create Homepage", 
                        False, 
                        f"Status: {response.status_code}, Response: {response.text}"
                    )
                    return None
                    
        except Exception as e:
            self.log_test("Homepage Creation/Update", False, f"Exception: {str(e)}")
            return None

    def test_update_homepage_title(self, homepage_data):
        """Test 4: PUT /api/pages/{id} - Update homepage blocks (change title in hero_home block)"""
        try:
            print("✏️ Testing PUT /api/pages/{id} (update hero title)...")
            
            if not homepage_data:
                self.log_test("PUT Update Hero Title", False, "No homepage data available")
                return None
                
            homepage_id = homepage_data.get('id')
            current_blocks = homepage_data.get('blocks', [])
            
            # Find and update hero_home block
            updated_blocks = []
            hero_updated = False
            
            for block in current_blocks:
                if block.get('type') == 'hero_home':
                    # Update the title in hero_home block
                    updated_block = block.copy()
                    updated_block['settings'] = block.get('settings', {}).copy()
                    updated_block['settings']['title'] = "Pengadilan Agama Penajam - UPDATED TITLE"
                    updated_blocks.append(updated_block)
                    hero_updated = True
                else:
                    updated_blocks.append(block)
            
            if not hero_updated:
                self.log_test("PUT Update Hero Title", False, "No hero_home block found to update")
                return None
            
            update_data = {
                "title": homepage_data.get('title'),
                "blocks": updated_blocks,
                "status": "published"
            }
            
            response = requests.put(
                f"{self.base_url}/api/pages/{homepage_id}",
                json=update_data,
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_test(
                    "PUT Update Hero Title", 
                    True, 
                    "Successfully updated hero_home block title"
                )
                return data
            else:
                self.log_test(
                    "PUT Update Hero Title", 
                    False, 
                    f"Status: {response.status_code}, Response: {response.text}"
                )
                return None
                
        except Exception as e:
            self.log_test("PUT Update Hero Title", False, f"Exception: {str(e)}")
            return None

    def test_get_homepage_after_update(self):
        """Test 5: GET /api/pages/slug/_homepage - Verify the change was saved"""
        try:
            print("🔍 Testing GET /api/pages/slug/_homepage (after update)...")
            response = requests.get(f"{self.base_url}/api/pages/slug/_homepage")
            
            if response.status_code == 200:
                data = response.json()
                blocks = data.get('blocks', [])
                
                # Check if hero_home block has updated title
                hero_block = None
                for block in blocks:
                    if block.get('type') == 'hero_home':
                        hero_block = block
                        break
                
                if hero_block:
                    hero_title = hero_block.get('settings', {}).get('title', '')
                    if "UPDATED TITLE" in hero_title:
                        self.log_test(
                            "GET Homepage (After Update)", 
                            True, 
                            f"Verified title update: '{hero_title}'"
                        )
                    else:
                        self.log_test(
                            "GET Homepage (After Update)", 
                            False, 
                            f"Title not updated. Current title: '{hero_title}'"
                        )
                else:
                    self.log_test(
                        "GET Homepage (After Update)", 
                        False, 
                        "No hero_home block found in updated homepage"
                    )
                
                return data
            else:
                self.log_test(
                    "GET Homepage (After Update)", 
                    False, 
                    f"Status: {response.status_code}, Response: {response.text}"
                )
                return None
                
        except Exception as e:
            self.log_test("GET Homepage (After Update)", False, f"Exception: {str(e)}")
            return None

    def test_auth_protection(self):
        """Test 6: Verify authentication is required for POST/PUT operations"""
        try:
            print("🔒 Testing authentication protection...")
            
            # Test POST without auth
            response = requests.post(
                f"{self.base_url}/api/pages",
                json={"title": "Test", "slug": "test", "blocks": []},
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 401:
                self.log_test(
                    "Auth Protection (POST)", 
                    True, 
                    "POST correctly requires authentication (401)"
                )
            else:
                self.log_test(
                    "Auth Protection (POST)", 
                    False, 
                    f"Expected 401, got {response.status_code}"
                )
            
            # Test PUT without auth (using a dummy ID)
            response = requests.put(
                f"{self.base_url}/api/pages/dummy-id",
                json={"title": "Test Update"},
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 401:
                self.log_test(
                    "Auth Protection (PUT)", 
                    True, 
                    "PUT correctly requires authentication (401)"
                )
            else:
                self.log_test(
                    "Auth Protection (PUT)", 
                    False, 
                    f"Expected 401, got {response.status_code}"
                )
                
        except Exception as e:
            self.log_test("Auth Protection", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Run all Homepage Builder API tests"""
        print("🚀 Starting Homepage Builder API Tests")
        print("=" * 60)
        print(f"Base URL: {self.base_url}")
        print(f"Admin Email: {ADMIN_EMAIL}")
        print("=" * 60)
        print()
        
        # Step 1: Authenticate
        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Step 2: Test initial homepage GET
        initial_homepage = self.test_get_homepage_initial()
        
        # Step 3: Test creating a test page
        test_page = self.test_create_test_page()
        
        # Step 4: Create or update homepage
        homepage_data = self.test_create_or_update_homepage()
        
        # Step 5: Update homepage (change hero title)
        if homepage_data:
            updated_homepage = self.test_update_homepage_title(homepage_data)
        
        # Step 6: Verify the update
        self.test_get_homepage_after_update()
        
        # Step 7: Test authentication protection
        self.test_auth_protection()
        
        # Print summary
        self.print_summary()
        
        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        print()
        
        print("📋 DETAILED RESULTS:")
        print("-" * 40)
        for result in self.test_results:
            status = "✅" if result['success'] else "❌"
            print(f"{status} {result['test']}")
            if result['details']:
                print(f"    {result['details']}")
        
        print("\n" + "=" * 60)
        
        if passed == total:
            print("🎉 ALL TESTS PASSED! Homepage Builder API is working correctly.")
        else:
            print(f"⚠️  {total - passed} test(s) failed. Please check the issues above.")
        
        print("=" * 60)

def main():
    """Main function"""
    tester = HomepageBuilderTester()
    
    try:
        success = tester.run_all_tests()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n\n⚠️ Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())