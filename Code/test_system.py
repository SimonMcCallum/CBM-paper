#!/usr/bin/env python3
"""
Test script to verify the enhanced AI testing system is working correctly.
This script performs basic validation without making actual API calls.
"""

import json
import os
import sys
from pathlib import Path

def test_config():
    """Test that configuration is properly set up."""
    print("🔧 Testing configuration...")
    
    try:
        from config import (
            QUESTION_FILE, MODEL_FILE, INTERACTION_LOG, ANSWERS_FILE,
            TEMPERATURES, NUM_REPETITIONS
        )
        print("✅ Configuration imports successful")
        
        # Check file paths
        if not os.path.exists(QUESTION_FILE):
            print(f"⚠️  Question file not found: {QUESTION_FILE}")
        else:
            print(f"✅ Question file found: {QUESTION_FILE}")
            
        if not os.path.exists(MODEL_FILE):
            print(f"⚠️  Model file not found: {MODEL_FILE}")
        else:
            print(f"✅ Model file found: {MODEL_FILE}")
            
        print(f"✅ Temperature settings: {TEMPERATURES}")
        print(f"✅ Repetitions per test: {NUM_REPETITIONS}")
        
    except ImportError as e:
        print(f"❌ Configuration import failed: {e}")
        return False
    
    return True

def test_question_format():
    """Test that questions are in the correct format."""
    print("\n📝 Testing question format...")
    
    try:
        from config import QUESTION_FILE
        
        with open(QUESTION_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Handle both old and new format
        questions = data.get('questions', data.get('eval_data', []))
        
        if not questions:
            print("❌ No questions found in file")
            return False
            
        print(f"✅ Found {len(questions)} questions")
        
        # Validate first question structure
        first_q = questions[0]
        required_fields = ['id', 'question', 'options', 'correctAnswer']
        
        for field in required_fields:
            if field not in first_q:
                print(f"❌ Missing required field '{field}' in question")
                return False
        
        print("✅ Question format validation passed")
        
        # Check options format
        options = first_q['options']
        if not isinstance(options, list) or len(options) == 0:
            print("❌ Options should be a non-empty list")
            return False
            
        first_option = options[0]
        if 'key' not in first_option or 'text' not in first_option:
            print("❌ Options should have 'key' and 'text' fields")
            return False
            
        print("✅ Options format validation passed")
        
    except Exception as e:
        print(f"❌ Question format test failed: {e}")
        return False
    
    return True

def test_model_config():
    """Test that model configuration is valid."""
    print("\n🤖 Testing model configuration...")
    
    try:
        from config import MODEL_FILE
        
        with open(MODEL_FILE, 'r', encoding='utf-8') as f:
            models = json.load(f)
        
        expected_vendors = ['OpenAI', 'Claude', 'Gemini', 'DeepSeek']
        
        for vendor in expected_vendors:
            if vendor in models:
                model_list = models[vendor].get('models', [])
                print(f"✅ {vendor}: {len(model_list)} models configured")
            else:
                print(f"⚠️  {vendor}: not configured")
        
        print("✅ Model configuration validation passed")
        
    except Exception as e:
        print(f"❌ Model configuration test failed: {e}")
        return False
    
    return True

def test_dependencies():
    """Test that required dependencies are installed."""
    print("\n📦 Testing dependencies...")
    
    required_packages = [
        'anthropic',
        'aiohttp',
        'requests',
        'json',
        'asyncio',
        'datetime',
        'statistics'
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
            print(f"✅ {package}")
        except ImportError:
            print(f"❌ {package} - not installed")
            missing_packages.append(package)
    
    if missing_packages:
        print(f"\n⚠️  Missing packages: {', '.join(missing_packages)}")
        print("Run: pip install -r requirements.txt")
        return False
    
    return True

def test_api_keys():
    """Test that API keys are configured (without revealing them)."""
    print("\n🔑 Testing API key configuration...")
    
    api_keys = {
        'OPENAI_API_KEY_CBM': 'OpenAI',
        'ANTHROPIC_API_KEY_CBM': 'Anthropic Claude',
        'GEMINI_API_KEY_CBM': 'Google Gemini',
        'DEEPSEEK_API_KEY_CBM': 'DeepSeek'
    }
    
    configured_keys = 0
    
    for env_var, service in api_keys.items():
        if os.environ.get(env_var):
            print(f"✅ {service} API key configured")
            configured_keys += 1
        else:
            print(f"⚠️  {service} API key not found (set {env_var})")
    
    if configured_keys == 0:
        print("❌ No API keys configured. Testing will not work without at least one API key.")
        return False
    elif configured_keys < len(api_keys):
        print(f"⚠️  Only {configured_keys}/{len(api_keys)} API keys configured. Some vendors will be skipped.")
    
    return True

def test_directories():
    """Test that required directories exist or can be created."""
    print("\n📁 Testing directory structure...")
    
    required_dirs = ['results', 'logs']
    
    for dir_name in required_dirs:
        if not os.path.exists(dir_name):
            try:
                os.makedirs(dir_name, exist_ok=True)
                print(f"✅ Created directory: {dir_name}")
            except Exception as e:
                print(f"❌ Failed to create directory {dir_name}: {e}")
                return False
        else:
            print(f"✅ Directory exists: {dir_name}")
    
    return True

def test_enhanced_ai_tester():
    """Test that the enhanced AI tester can be imported."""
    print("\n🧪 Testing enhanced AI tester...")
    
    try:
        # Add the Code directory to the path
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        
        from enhanced_ai_tester import EnhancedAITester, ConfidenceResponse, TestResult
        print("✅ Enhanced AI tester imports successful")
        
        # Test CBM matrix
        tester = EnhancedAITester()
        cbm_score = tester.calculate_cbm_score(0.8, True)  # High confidence, correct
        if cbm_score == 1.5:
            print("✅ CBM scoring calculation works correctly")
        else:
            print(f"⚠️  CBM scoring may have issues. Expected 1.5, got {cbm_score}")
        
        print("✅ Enhanced AI tester validation passed")
        
    except Exception as e:
        print(f"❌ Enhanced AI tester test failed: {e}")
        return False
    
    return True

def main():
    """Run all tests."""
    print("🚀 Starting Enhanced AI Testing System Validation\n")
    
    tests = [
        test_config,
        test_question_format,
        test_model_config,
        test_dependencies,
        test_api_keys,
        test_directories,
        test_enhanced_ai_tester
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
        print()  # Add spacing between tests
    
    print("=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! The system is ready for AI testing.")
        print("\nNext steps:")
        print("1. Start the web server: cd cbm-question-system && npm start")
        print("2. Open http://localhost:3000 in your browser")
        print("3. Navigate to 'AI Testing' and click 'Run AI Testing'")
        print("4. Or run directly: python enhanced_ai_tester.py")
    else:
        print("⚠️  Some tests failed. Please address the issues above before running AI tests.")
        
        if passed >= total * 0.7:  # If most tests pass
            print("\nYou may still be able to run limited testing with the configured components.")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
