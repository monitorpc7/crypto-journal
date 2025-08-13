import requests
import sys
import json
from datetime import datetime, date
from typing import Dict, Any

class TradingJournalAPITester:
    def __init__(self, base_url="https://trade-journal-41.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_trade_ids = []

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, data: Dict[Any, Any] = None, params: Dict[str, str] = None) -> tuple:
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if method == 'POST' and 'id' in response_data:
                        print(f"   Created ID: {response_data['id']}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_api_root(self):
        """Test API root endpoint"""
        return self.run_test("API Root", "GET", "", 200)

    def test_create_trade(self, trade_data: Dict[str, Any]):
        """Test creating a trade"""
        success, response = self.run_test(
            f"Create Trade ({trade_data['symbol']})",
            "POST",
            "trades",
            200,
            data=trade_data
        )
        if success and 'id' in response:
            self.created_trade_ids.append(response['id'])
            return response['id']
        return None

    def test_get_trades(self, params: Dict[str, str] = None):
        """Test getting trades with optional filters"""
        test_name = "Get Trades"
        if params:
            test_name += f" (with filters: {params})"
        
        success, response = self.run_test(
            test_name,
            "GET",
            "trades",
            200,
            params=params
        )
        return success, response

    def test_get_trade_by_id(self, trade_id: str):
        """Test getting a specific trade"""
        return self.run_test(
            f"Get Trade by ID ({trade_id[:8]}...)",
            "GET",
            f"trades/{trade_id}",
            200
        )

    def test_update_trade(self, trade_id: str, update_data: Dict[str, Any]):
        """Test updating a trade"""
        return self.run_test(
            f"Update Trade ({trade_id[:8]}...)",
            "PUT",
            f"trades/{trade_id}",
            200,
            data=update_data
        )

    def test_delete_trade(self, trade_id: str):
        """Test deleting a trade"""
        return self.run_test(
            f"Delete Trade ({trade_id[:8]}...)",
            "DELETE",
            f"trades/{trade_id}",
            200
        )

    def test_get_stats(self):
        """Test getting trading statistics"""
        return self.run_test(
            "Get Trading Stats",
            "GET",
            "trades/stats/summary",
            200
        )

def main():
    print("🚀 Starting Trading Journal API Tests")
    print("=" * 50)
    
    tester = TradingJournalAPITester()
    
    # Test 1: API Root
    tester.test_api_root()
    
    # Test 2: Get initial stats (should be empty)
    print("\n📊 Testing initial stats...")
    tester.test_get_stats()
    
    # Test 3: Get trades (should be empty initially)
    print("\n📋 Testing empty trades list...")
    tester.test_get_trades()
    
    # Test 4: Create sample trades
    print("\n➕ Testing trade creation...")
    
    sample_trades = [
        {
            "symbol": "AAPL",
            "entry_price": 150.00,
            "exit_price": 155.00,
            "quantity": 100,
            "trade_date": "2024-01-15",
            "strategy": "Swing Trading",
            "trade_type": "Long",
            "stop_loss": 145.00,
            "take_profit": 160.00,
            "notes": "Strong earnings report expected"
        },
        {
            "symbol": "TSLA",
            "entry_price": 200.00,
            "exit_price": 190.00,
            "quantity": 50,
            "trade_date": "2024-01-16",
            "strategy": "Scalping",
            "trade_type": "Short",
            "stop_loss": 205.00,
            "take_profit": 185.00,
            "notes": "Overvalued, expecting correction"
        },
        {
            "symbol": "MSFT",
            "entry_price": 300.00,
            "exit_price": None,  # Open position
            "quantity": 75,
            "trade_date": "2024-01-17",
            "strategy": "Long Term Hold",
            "trade_type": "Long",
            "stop_loss": 280.00,
            "take_profit": 350.00,
            "notes": "Strong fundamentals, holding long term"
        }
    ]
    
    created_ids = []
    for trade in sample_trades:
        trade_id = tester.test_create_trade(trade)
        if trade_id:
            created_ids.append(trade_id)
    
    # Test 5: Get trades after creation
    print("\n📋 Testing trades list after creation...")
    success, trades_response = tester.test_get_trades()
    if success:
        print(f"   Found {trades_response.get('total', 0)} trades")
    
    # Test 6: Test individual trade retrieval
    if created_ids:
        print("\n🔍 Testing individual trade retrieval...")
        tester.test_get_trade_by_id(created_ids[0])
    
    # Test 7: Test trade update
    if created_ids:
        print("\n✏️ Testing trade update...")
        update_data = {
            "exit_price": 158.00,
            "notes": "Updated exit price after market close"
        }
        tester.test_update_trade(created_ids[0], update_data)
    
    # Test 8: Test filtering and search
    print("\n🔍 Testing search and filters...")
    
    # Search by symbol
    tester.test_get_trades({"search": "AAPL"})
    
    # Filter by trade type
    tester.test_get_trades({"trade_type": "Long"})
    
    # Filter by strategy
    tester.test_get_trades({"strategy": "Swing"})
    
    # Test pagination
    tester.test_get_trades({"page": "1", "limit": "2"})
    
    # Test sorting
    tester.test_get_trades({"sort_by": "pnl", "sort_order": "desc"})
    
    # Test 9: Get updated stats
    print("\n📊 Testing updated stats...")
    success, stats = tester.test_get_stats()
    if success:
        print(f"   Total Trades: {stats.get('total_trades', 0)}")
        print(f"   Total P&L: ${stats.get('total_pnl', 0)}")
        print(f"   Win Rate: {stats.get('win_rate', 0)}%")
    
    # Test 10: Test trade deletion
    if created_ids and len(created_ids) > 1:
        print("\n🗑️ Testing trade deletion...")
        tester.test_delete_trade(created_ids[-1])  # Delete last created trade
    
    # Test 11: Verify deletion worked
    if created_ids and len(created_ids) > 1:
        print("\n✅ Verifying deletion...")
        success, _ = tester.test_get_trade_by_id(created_ids[-1])
        if not success:
            print("✅ Trade deletion verified - trade not found as expected")
            tester.tests_passed += 1
        tester.tests_run += 1
    
    # Test 12: Test error cases
    print("\n❌ Testing error cases...")
    
    # Test getting non-existent trade
    fake_id = "non-existent-id"
    success, _ = tester.run_test(
        "Get Non-existent Trade",
        "GET",
        f"trades/{fake_id}",
        404
    )
    
    # Test creating trade with invalid data
    invalid_trade = {
        "symbol": "",  # Empty symbol should fail
        "entry_price": "invalid",  # Invalid price
        "quantity": -10  # Negative quantity
    }
    tester.run_test(
        "Create Invalid Trade",
        "POST",
        "trades",
        422  # Validation error
    )
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 FINAL RESULTS:")
    print(f"   Tests Run: {tester.tests_run}")
    print(f"   Tests Passed: {tester.tests_passed}")
    print(f"   Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️ {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())