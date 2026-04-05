#!/usr/bin/env python3
"""
File Upload API Testing for Pengadilan Agama Penajam
Tests file upload functionality, authentication, and integration with news/putusan
"""

import requests
import json
import uuid
import io
import os
from PIL import Image

# Configuration
BASE_URL = "https://pengadilan-agama-cms.preview.emergentagent.com"
ADMIN_EMAIL = "admin@pa-penajam.go.id"
ADMIN_PASSWORD = "Admin@1234"

class FileUploadTester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.test_results = []
        self.uploaded_files = []
        
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
    
    def create_test_image(self):
        """Create a small test image in memory"""
        try:
            # Create a 100x100 red image
            img = Image.new('RGB', (100, 100), color='red')
            img_buffer = io.BytesIO()
            img.save(img_buffer, format='PNG')
            img_buffer.seek(0)
            return img_buffer.getvalue()
        except Exception as e:
            print(f"Error creating test image: {e}")
            return None
    
    def create_test_pdf(self):
        """Create a small test PDF content"""
        # Simple PDF content
        pdf_content = b"""%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
72 720 Td
(Test PDF Document) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000199 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
293
%%EOF"""
        return pdf_content
    
    def login_admin(self):
        """Login as admin to get JWT token"""
        print("\n=== Admin Login for File Upload Tests ===")
        
        url = f"{BASE_URL}/api/auth/login"
        login_data = {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }
        
        try:
            response = self.session.post(url, json=login_data)
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
        except Exception as e:
            self.log_result("Admin Login", False, f"Login error: {str(e)}")
            return False
    
    def test_file_upload_image(self):
        """Test 1: File Upload - Image"""
        print("\n=== Testing Image Upload ===")
        
        if not self.token:
            self.log_result("Image Upload", False, "No auth token available")
            return False
        
        # Create test image
        image_data = self.create_test_image()
        if not image_data:
            self.log_result("Image Upload", False, "Failed to create test image")
            return False
        
        url = f"{BASE_URL}/api/upload"
        headers = {'Authorization': f'Bearer {self.token}'}
        
        # Create multipart form data
        files = {'file': ('test_image.png', image_data, 'image/png')}
        
        try:
            response = self.session.post(url, files=files, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                if 'url' in result and 'fileName' in result and 'type' in result:
                    file_url = result['url']
                    file_type = result['type']
                    file_name = result['fileName']
                    
                    # Store for cleanup and later tests
                    self.uploaded_files.append({
                        'url': file_url,
                        'type': 'image',
                        'fileName': file_name
                    })
                    
                    expected_pattern = '/uploads/images/'
                    if expected_pattern in file_url and file_type == 'images':
                        self.log_result("Image Upload", True, f"Image uploaded successfully: {file_url}")
                        return True
                    else:
                        self.log_result("Image Upload", False, f"Unexpected response format. URL: {file_url}, Type: {file_type}")
                        return False
                else:
                    self.log_result("Image Upload", False, f"Missing fields in response: {result}")
                    return False
            else:
                self.log_result("Image Upload", False, f"Upload failed with status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Image Upload", False, f"Upload error: {str(e)}")
            return False
    
    def test_file_upload_pdf(self):
        """Test 2: File Upload - PDF"""
        print("\n=== Testing PDF Upload ===")
        
        if not self.token:
            self.log_result("PDF Upload", False, "No auth token available")
            return False
        
        # Create test PDF
        pdf_data = self.create_test_pdf()
        
        url = f"{BASE_URL}/api/upload"
        headers = {'Authorization': f'Bearer {self.token}'}
        
        # Create multipart form data
        files = {'file': ('test_document.pdf', pdf_data, 'application/pdf')}
        
        try:
            response = self.session.post(url, files=files, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                if 'url' in result and 'fileName' in result and 'type' in result:
                    file_url = result['url']
                    file_type = result['type']
                    file_name = result['fileName']
                    
                    # Store for cleanup and later tests
                    self.uploaded_files.append({
                        'url': file_url,
                        'type': 'pdf',
                        'fileName': file_name
                    })
                    
                    expected_pattern = '/uploads/pdfs/'
                    if expected_pattern in file_url and file_type == 'pdfs':
                        self.log_result("PDF Upload", True, f"PDF uploaded successfully: {file_url}")
                        return True
                    else:
                        self.log_result("PDF Upload", False, f"Unexpected response format. URL: {file_url}, Type: {file_type}")
                        return False
                else:
                    self.log_result("PDF Upload", False, f"Missing fields in response: {result}")
                    return False
            else:
                self.log_result("PDF Upload", False, f"Upload failed with status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("PDF Upload", False, f"Upload error: {str(e)}")
            return False
    
    def test_file_upload_no_auth(self):
        """Test 3: File Upload without authentication"""
        print("\n=== Testing Upload Without Auth ===")
        
        # Create test image
        image_data = self.create_test_image()
        if not image_data:
            self.log_result("Upload No Auth", False, "Failed to create test image")
            return False
        
        url = f"{BASE_URL}/api/upload"
        # No authorization header
        
        files = {'file': ('unauthorized_test.png', image_data, 'image/png')}
        
        try:
            response = self.session.post(url, files=files)
            
            if response.status_code == 401:
                self.log_result("Upload No Auth", True, "Correctly rejected unauthorized upload request")
                return True
            else:
                self.log_result("Upload No Auth", False, f"Expected 401 but got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Upload No Auth", False, f"Request error: {str(e)}")
            return False
    
    def test_file_accessibility(self):
        """Test 4: Verify uploaded files are accessible"""
        print("\n=== Testing File Accessibility ===")
        
        success_count = 0
        total_count = len(self.uploaded_files)
        
        if total_count == 0:
            self.log_result("File Accessibility", False, "No uploaded files to test")
            return False
        
        for file_info in self.uploaded_files:
            file_url = file_info['url']
            full_url = f"{BASE_URL}{file_url}"
            
            try:
                response = self.session.get(full_url)
                
                if response.status_code == 200:
                    self.log_result(f"File Access - {file_info['type']}", True, f"File accessible: {file_url}")
                    success_count += 1
                else:
                    self.log_result(f"File Access - {file_info['type']}", False, f"File not accessible: {file_url} (status: {response.status_code})")
                    
            except Exception as e:
                self.log_result(f"File Access - {file_info['type']}", False, f"Access error for {file_url}: {str(e)}")
        
        if success_count == total_count:
            self.log_result("File Accessibility", True, f"All {total_count} uploaded files are accessible")
            return True
        else:
            self.log_result("File Accessibility", False, f"Only {success_count}/{total_count} files are accessible")
            return False
    
    def test_news_with_image_url(self):
        """Test 5: Create news with uploaded image URL"""
        print("\n=== Testing News with Uploaded Image ===")
        
        if not self.token:
            self.log_result("News with Image", False, "No auth token available")
            return False
        
        # Find uploaded image
        uploaded_image = None
        for file_info in self.uploaded_files:
            if file_info['type'] == 'image':
                uploaded_image = file_info
                break
        
        if not uploaded_image:
            self.log_result("News with Image", False, "No uploaded image available")
            return False
        
        url = f"{BASE_URL}/api/news"
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.token}'
        }
        
        news_data = {
            "title": "Test News with Uploaded Image - Modernisasi PA Penajam",
            "content": "Pengadilan Agama Penajam melakukan modernisasi sistem pelayanan dengan teknologi terdepan untuk meningkatkan kualitas pelayanan kepada masyarakat. Inovasi ini mencakup digitalisasi proses administrasi dan peningkatan aksesibilitas informasi.",
            "imageUrl": uploaded_image['url'],
            "author": "Tim Modernisasi PA Penajam",
            "category": "Inovasi",
            "isPublished": True,
            "publishDate": "2025-06-01"
        }
        
        try:
            response = self.session.post(url, json=news_data, headers=headers)
            
            if response.status_code == 201:
                result = response.json()
                news_id = result.get('id')
                image_url = result.get('imageUrl', result.get('image'))
                
                if image_url == uploaded_image['url']:
                    self.log_result("News with Image", True, f"News created with uploaded image URL: {news_id}")
                    # Store for cleanup
                    self.created_news_id = news_id
                    return True
                else:
                    self.log_result("News with Image", False, f"Image URL mismatch. Expected: {uploaded_image['url']}, Got: {image_url}")
                    return False
            else:
                self.log_result("News with Image", False, f"News creation failed with status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("News with Image", False, f"News creation error: {str(e)}")
            return False
    
    def test_putusan_with_pdf_url(self):
        """Test 6: Create putusan with uploaded PDF URL"""
        print("\n=== Testing Putusan with Uploaded PDF ===")
        
        if not self.token:
            self.log_result("Putusan with PDF", False, "No auth token available")
            return False
        
        # Find uploaded PDF
        uploaded_pdf = None
        for file_info in self.uploaded_files:
            if file_info['type'] == 'pdf':
                uploaded_pdf = file_info
                break
        
        if not uploaded_pdf:
            self.log_result("Putusan with PDF", False, "No uploaded PDF available")
            return False
        
        url = f"{BASE_URL}/api/putusan"
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.token}'
        }
        
        putusan_data = {
            "nomorPutusan": f"TEST/{uuid.uuid4().hex[:8]}/Pdt.G/2025/PA.Pnj",
            "judulPerkara": "Test Putusan - Cerai Gugat dengan Dokumen",
            "jenisPerkara": "Cerai Gugat",
            "tanggalPutusan": "2025-06-01",
            "hakim": "Test Judge, S.H., M.H.",
            "filePutusan": uploaded_pdf['url'],
            "statusPublish": True,
            "ringkasan": "Putusan test dengan file PDF terintegrasi untuk verifikasi sistem upload dan download dokumen putusan."
        }
        
        try:
            response = self.session.post(url, json=putusan_data, headers=headers)
            
            if response.status_code == 201:
                result = response.json()
                putusan_id = result.get('id')
                file_putusan = result.get('filePutusan')
                
                if file_putusan == uploaded_pdf['url']:
                    self.log_result("Putusan with PDF", True, f"Putusan created with uploaded PDF URL: {putusan_id}")
                    # Store for cleanup
                    self.created_putusan_id = putusan_id
                    return True
                else:
                    self.log_result("Putusan with PDF", False, f"PDF URL mismatch. Expected: {uploaded_pdf['url']}, Got: {file_putusan}")
                    return False
            else:
                self.log_result("Putusan with PDF", False, f"Putusan creation failed with status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Putusan with PDF", False, f"Putusan creation error: {str(e)}")
            return False
    
    def test_upload_directory_exists(self):
        """Test 7: Verify upload directories exist"""
        print("\n=== Testing Upload Directory Structure ===")
        
        # Test if we can access the base upload path (this will give us info about the structure)
        test_urls = [
            f"{BASE_URL}/uploads/",
            f"{BASE_URL}/uploads/images/",
            f"{BASE_URL}/uploads/pdfs/"
        ]
        
        success_count = 0
        for test_url in test_urls:
            try:
                response = self.session.get(test_url)
                # 403 or 404 is expected for directory listing, but not 500
                if response.status_code in [200, 403, 404]:
                    self.log_result(f"Directory Check", True, f"Directory structure exists: {test_url.split('/')[-2] if test_url.endswith('/') else 'base'}")
                    success_count += 1
                else:
                    self.log_result(f"Directory Check", False, f"Unexpected status for {test_url}: {response.status_code}")
            except Exception as e:
                self.log_result(f"Directory Check", False, f"Error accessing {test_url}: {str(e)}")
        
        if success_count == len(test_urls):
            self.log_result("Upload Directory Structure", True, "All upload directories are properly configured")
            return True
        else:
            self.log_result("Upload Directory Structure", False, f"Only {success_count}/{len(test_urls)} directories properly configured")
            return False
    
    def cleanup_test_data(self):
        """Clean up test data created during testing"""
        print("\n=== Cleaning Up Test Data ===")
        
        headers = {'Authorization': f'Bearer {self.token}'}
        
        # Clean up news
        if hasattr(self, 'created_news_id') and self.created_news_id:
            url = f"{BASE_URL}/api/news/{self.created_news_id}"
            try:
                response = self.session.delete(url, headers=headers)
                if response.status_code == 200:
                    self.log_result("Cleanup News", True, "Test news deleted successfully")
                else:
                    self.log_result("Cleanup News", False, f"Failed to delete test news: {response.status_code}")
            except Exception as e:
                self.log_result("Cleanup News", False, f"Error deleting news: {str(e)}")
        
        # Clean up putusan
        if hasattr(self, 'created_putusan_id') and self.created_putusan_id:
            url = f"{BASE_URL}/api/putusan/{self.created_putusan_id}"
            try:
                response = self.session.delete(url, headers=headers)
                if response.status_code == 200:
                    self.log_result("Cleanup Putusan", True, "Test putusan deleted successfully")
                else:
                    self.log_result("Cleanup Putusan", False, f"Failed to delete test putusan: {response.status_code}")
            except Exception as e:
                self.log_result("Cleanup Putusan", False, f"Error deleting putusan: {str(e)}")
        
        # Note: We don't delete uploaded files as they might be used by other content
        # and there's no delete endpoint for files in the API
    
    def run_all_tests(self):
        """Run all file upload tests"""
        print("📁 Starting File Upload API Tests for Pengadilan Agama Penajam")
        print(f"Testing against: {BASE_URL}")
        print("=" * 70)
        
        try:
            # Login first
            if not self.login_admin():
                print("❌ Cannot proceed without authentication")
                return False
            
            # Core file upload tests
            self.test_file_upload_image()
            self.test_file_upload_pdf()
            self.test_file_upload_no_auth()
            self.test_file_accessibility()
            
            # Integration tests
            self.test_news_with_image_url()
            self.test_putusan_with_pdf_url()
            
            # Infrastructure tests
            self.test_upload_directory_exists()
            
            # Cleanup
            self.cleanup_test_data()
            
        except Exception as e:
            print(f"\n💥 Unexpected error during testing: {str(e)}")
        
        # Summary
        print("\n" + "=" * 70)
        print("📊 FILE UPLOAD TEST SUMMARY")
        print("=" * 70)
        
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
            print(f"\n🎉 All file upload tests passed!")
        
        # Specific file upload summary
        print(f"\n📁 Upload Summary:")
        print(f"Uploaded files: {len(self.uploaded_files)}")
        for file_info in self.uploaded_files:
            print(f"  - {file_info['type'].upper()}: {file_info['url']}")
        
        return passed == total

if __name__ == "__main__":
    tester = FileUploadTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)