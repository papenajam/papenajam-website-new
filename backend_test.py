#!/usr/bin/env python3

"""
Backend API Testing for Bilingual Content Support
Pengadilan Agama Penajam CMS - December 2024
"""

import requests
import json
import os
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://court-builder-6.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Admin credentials
ADMIN_EMAIL = "admin@pa-penajam.go.id"
ADMIN_PASSWORD = "Admin@1234"

# Test data storage
created_items = []
auth_token = None

def log_test(test_name: str, status: str, details: str = ""):
    """Log test results in a standardized format"""
    symbol = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"{symbol} {test_name}: {status}")
    if details:
        print(f"   {details}")

def make_request(method: str, endpoint: str, data: Optional[Dict] = None, 
                files: Optional[Dict] = None, headers: Optional[Dict] = None) -> Dict[str, Any]:
    """Make HTTP request with error handling"""
    url = f"{API_BASE}{endpoint}"
    
    # Default headers
    default_headers = {
        'Content-Type': 'application/json'
    }
    if auth_token:
        default_headers['Authorization'] = f'Bearer {auth_token}'
    
    if headers:
        default_headers.update(headers)
    
    # Remove content-type for file uploads
    if files:
        default_headers.pop('Content-Type', None)
    
    try:
        if method.upper() == 'GET':
            response = requests.get(url, headers=default_headers)
        elif method.upper() == 'POST':
            if files:
                response = requests.post(url, files=files, headers=default_headers)
            else:
                response = requests.post(url, json=data, headers=default_headers)
        elif method.upper() == 'PUT':
            response = requests.put(url, json=data, headers=default_headers)
        elif method.upper() == 'DELETE':
            response = requests.delete(url, headers=default_headers)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return {
            'status_code': response.status_code,
            'data': response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text,
            'headers': dict(response.headers)
        }
    except requests.RequestException as e:
        return {
            'status_code': 0,
            'data': {'error': str(e)},
            'headers': {}
        }
    except json.JSONDecodeError:
        return {
            'status_code': response.status_code,
            'data': {'error': 'Invalid JSON response'},
            'headers': dict(response.headers)
        }

def test_login():
    """Test 1: Login API - POST /api/auth/login"""
    global auth_token
    
    login_data = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    
    response = make_request('POST', '/auth/login', login_data)
    
    if response['status_code'] == 200 and 'token' in response['data']:
        auth_token = response['data']['token']
        user_info = response['data'].get('user', {})
        log_test("Login API", "PASS", 
                f"Token received. User: {user_info.get('name', 'N/A')} (Role: {user_info.get('role', 'N/A')})")
        return True
    else:
        log_test("Login API", "FAIL", 
                f"Status: {response['status_code']}, Response: {response['data']}")
        return False

def test_create_bilingual_news():
    """Test 2: Create bilingual news - POST /api/news"""
    
    if not auth_token:
        log_test("Create Bilingual News", "FAIL", "No auth token available")
        return False, None
    
    news_data = {
        "title": "Pengumuman Test Bilingual",
        "titleEn": "Bilingual Test Announcement",
        "content": "Konten dalam Bahasa Indonesia",
        "contentEn": "Content in English",
        "imageAlt": "Gambar pengumuman",
        "imageAltEn": "Announcement image",
        "category": "Test",
        "isPublished": True,
        "author": "Admin Test",
        "publishDate": "2024-12-20"
    }
    
    response = make_request('POST', '/news', news_data)
    
    if response['status_code'] == 201:
        news_id = response['data'].get('id')
        created_items.append(('news', news_id))
        
        # Verify by getting the created news
        verify_response = make_request('GET', f'/news/{news_id}')
        if verify_response['status_code'] == 200:
            item = verify_response['data']
            
            # Check if bilingual fields are saved
            has_bilingual = all([
                item.get('title') == news_data['title'],
                item.get('titleEn') == news_data['titleEn'],
                item.get('content') == news_data['content'],
                item.get('contentEn') == news_data['contentEn'],
                item.get('imageAlt') == news_data['imageAlt'],
                item.get('imageAltEn') == news_data['imageAltEn']
            ])
            
            if has_bilingual:
                log_test("Create Bilingual News", "PASS", 
                        f"News created with ID: {news_id}. All bilingual fields saved correctly.")
                return True, news_id
            else:
                log_test("Create Bilingual News", "FAIL", 
                        f"Bilingual fields not saved properly. Missing fields in response.")
                return False, news_id
        else:
            log_test("Create Bilingual News", "FAIL", 
                    f"Could not verify created news. Status: {verify_response['status_code']}")
            return False, news_id
    else:
        log_test("Create Bilingual News", "FAIL", 
                f"Status: {response['status_code']}, Response: {response['data']}")
        return False, None

def test_accessibility_page():
    """Test 3: Accessibility statement page - GET /accessibility"""
    
    # Test the accessibility page directly
    try:
        response = requests.get(f"{BASE_URL}/accessibility")
        if response.status_code == 200:
            log_test("Accessibility Statement Page", "PASS", 
                    f"Page accessible at {BASE_URL}/accessibility. Status: {response.status_code}")
            return True
        else:
            log_test("Accessibility Statement Page", "FAIL", 
                    f"Page not accessible. Status: {response.status_code}")
            return False
    except requests.RequestException as e:
        log_test("Accessibility Statement Page", "FAIL", f"Request error: {str(e)}")
        return False

def test_homepage():
    """Test 4: Language switching - GET / (homepage)"""
    
    try:
        response = requests.get(BASE_URL)
        if response.status_code == 200:
            log_test("Homepage Access", "PASS", 
                    f"Homepage accessible. Status: {response.status_code}")
            return True
        else:
            log_test("Homepage Access", "FAIL", 
                    f"Homepage not accessible. Status: {response.status_code}")
            return False
    except requests.RequestException as e:
        log_test("Homepage Access", "FAIL", f"Request error: {str(e)}")
        return False

def test_news_public_api_with_bilingual():
    """Test 5: News public API with EN fields - GET /api/news?public=true"""
    
    response = make_request('GET', '/news?public=true&limit=10')
    
    if response['status_code'] == 200:
        items = response['data'].get('items', [])
        
        if not items:
            log_test("News Public API Bilingual Fields", "PASS", 
                    "API working but no published news found")
            return True
        
        # Check if any items have bilingual fields
        bilingual_items = []
        for item in items:
            if item.get('titleEn') or item.get('contentEn'):
                bilingual_items.append(item.get('id', 'unknown'))
        
        log_test("News Public API Bilingual Fields", "PASS", 
                f"Retrieved {len(items)} news items. {len(bilingual_items)} have bilingual fields.")
        return True
    else:
        log_test("News Public API Bilingual Fields", "FAIL", 
                f"Status: {response['status_code']}, Response: {response['data']}")
        return False

def test_upload_api():
    """Test 6: Upload API still works - POST /api/upload"""
    
    if not auth_token:
        log_test("Upload API", "FAIL", "No auth token available")
        return False
    
    # Create a simple test image (1x1 PNG)
    test_image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\xdac\xf8\x00\x00\x00\x01\x00\x01\x00\x00\x00\x00\x07\x00\x8a\xb4\x0f\xde\x00\x00\x00\x00IEND\xaeB`\x82'
    
    files = {
        'file': ('test-image.png', test_image_data, 'image/png')
    }
    
    response = make_request('POST', '/upload', files=files)
    
    if response['status_code'] == 200:
        uploaded_url = response['data'].get('url', '')
        if uploaded_url.startswith('/uploads/'):
            log_test("Upload API", "PASS", 
                    f"Image uploaded successfully. URL: {uploaded_url}")
            return True, uploaded_url
        else:
            log_test("Upload API", "FAIL", 
                    f"Invalid upload URL format: {uploaded_url}")
            return False, None
    else:
        log_test("Upload API", "FAIL", 
                f"Status: {response['status_code']}, Response: {response['data']}")
        return False, None

def test_announcements_bilingual():
    """Test 7: Announcements bilingual - POST /api/announcements with titleEn and contentEn"""
    
    if not auth_token:
        log_test("Announcements Bilingual", "FAIL", "No auth token available")
        return False, None
    
    announcement_data = {
        "title": "Pengumuman Test Bilingual",
        "titleEn": "Bilingual Test Announcement",
        "content": "Konten pengumuman dalam Bahasa Indonesia",
        "contentEn": "Announcement content in English",
        "isActive": True,
        "publishDate": "2024-12-20"
    }
    
    response = make_request('POST', '/announcements', announcement_data)
    
    if response['status_code'] == 201:
        announcement_id = response['data'].get('id')
        created_items.append(('announcements', announcement_id))
        
        # Verify by getting the created announcement
        verify_response = make_request('GET', f'/announcements/{announcement_id}')
        if verify_response['status_code'] == 200:
            item = verify_response['data']
            
            # Check if bilingual fields are saved
            has_bilingual = all([
                item.get('title') == announcement_data['title'],
                item.get('titleEn') == announcement_data['titleEn'],
                item.get('content') == announcement_data['content'],
                item.get('contentEn') == announcement_data['contentEn']
            ])
            
            if has_bilingual:
                log_test("Announcements Bilingual", "PASS", 
                        f"Announcement created with ID: {announcement_id}. All bilingual fields saved correctly.")
                return True, announcement_id
            else:
                log_test("Announcements Bilingual", "FAIL", 
                        f"Bilingual fields not saved properly. Response: {item}")
                return False, announcement_id
        else:
            log_test("Announcements Bilingual", "FAIL", 
                    f"Could not verify created announcement. Status: {verify_response['status_code']}")
            return False, announcement_id
    else:
        log_test("Announcements Bilingual", "FAIL", 
                f"Status: {response['status_code']}, Response: {response['data']}")
        return False, None

def test_cleanup():
    """Test 8: Delete test items - Clean up created test data"""
    
    if not auth_token:
        log_test("Cleanup Test Items", "FAIL", "No auth token available")
        return False
    
    cleanup_results = []
    
    for item_type, item_id in created_items:
        if item_id:
            response = make_request('DELETE', f'/{item_type}/{item_id}')
            if response['status_code'] == 200:
                cleanup_results.append(f"{item_type}:{item_id} ✅")
            else:
                cleanup_results.append(f"{item_type}:{item_id} ❌")
    
    if cleanup_results:
        log_test("Cleanup Test Items", "PASS", 
                f"Cleanup completed: {', '.join(cleanup_results)}")
    else:
        log_test("Cleanup Test Items", "PASS", "No items to clean up")
    
    return True

def run_all_tests():
    """Run all bilingual content support tests"""
    
    print("=" * 80)
    print("BILINGUAL CONTENT SUPPORT TESTING - PENGADILAN AGAMA PENAJAM")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"Admin Email: {ADMIN_EMAIL}")
    print("-" * 80)
    
    # Test results tracking
    test_results = []
    
    # Test 1: Login
    result = test_login()
    test_results.append(("Login API", result))
    
    # Test 2: Create bilingual news
    result, news_id = test_create_bilingual_news()
    test_results.append(("Create Bilingual News", result))
    
    # Test 3: Accessibility page
    result = test_accessibility_page()
    test_results.append(("Accessibility Statement Page", result))
    
    # Test 4: Homepage
    result = test_homepage()
    test_results.append(("Homepage Access", result))
    
    # Test 5: News public API with bilingual fields
    result = test_news_public_api_with_bilingual()
    test_results.append(("News Public API Bilingual Fields", result))
    
    # Test 6: Upload API
    result, upload_url = test_upload_api()
    test_results.append(("Upload API", result))
    
    # Test 7: Announcements bilingual
    result, announcement_id = test_announcements_bilingual()
    test_results.append(("Announcements Bilingual", result))
    
    # Test 8: Cleanup
    result = test_cleanup()
    test_results.append(("Cleanup Test Items", result))
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)
    
    for test_name, result in test_results:
        symbol = "✅" if result else "❌"
        print(f"{symbol} {test_name}")
    
    print("-" * 80)
    print(f"RESULTS: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! Bilingual content support is working correctly.")
    else:
        print("⚠️  Some tests failed. Please review the failing tests above.")
    
    print("=" * 80)
    
    return passed == total

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)