import requests
import sys
import json
from datetime import datetime, date
from typing import Dict, Any

class CryptoTradingJournalAPITester:
    def __init__(self, base_url="http://localhost:8000"):
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
                        print(f"   Calculated Quantity: {response_data.get('quantity', 'N/A')}")
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

    def test_create_crypto_trade(self, trade_data: Dict[str, Any]):
        """Test creating a crypto trade"""
        success, response = self.run_test(
            f"Create Crypto Trade ({trade_data['pair']})",
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
        test_name = "Get Crypto Trades"
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

    def test_mexc_popular_pairs(self):
        """Test MEXC popular pairs endpoint"""
        return self.run_test(
            "Get MEXC Popular Pairs",
            "GET",
            "mexc/popular-pairs",
            200
        )

    def test_mexc_ticker(self, symbols: str):
        """Test MEXC ticker endpoint"""
        return self.run_test(
            f"Get MEXC Ticker ({symbols})",
            "GET",
            "mexc/ticker",
            200,
            params={"symbols": symbols}
        )

def main():
    print("🚀 Starting Crypto Trading Journal API Tests")
    print("=" * 50)
    
    tester = CryptoTradingJournalAPITester()
    
    # Test 1: API Root
    tester.test_api_root()
    
    # Test 2: Test MEXC API Integration
    print("\n🌐 Testing MEXC API Integration...")
    tester.test_mexc_popular_pairs()
    tester.test_mexc_ticker("BTC/USDT,ETH/USDT")
    
    # Test 3: Get initial stats (should be empty)
    print("\n📊 Testing initial stats...")
    tester.test_get_stats()
    
    # Test 4: Get trades (should be empty initially)
    print("\n📋 Testing empty trades list...")
    tester.test_get_trades()
    
    # Test 5: Create sample crypto trades
    print("\n➕ Testing crypto trade creation...")
    
    sample_crypto_trades = [
        {
            "pair": "BTC/USDT",
            "entry_price": 45000.00,
            "exit_price": 47000.00,
            "usd_amount": 1000.00,
            "trade_date": "2024-01-15",
            "strategy": "DCA",
            "trade_type": "Long",
            "stop_loss": 42000.00,
            "take_profit": 50000.00,
            "notes": "Bitcoin accumulation strategy"
        },
        {
            "pair": "ETH/USDT",
            "entry_price": 2500.00,
            "exit_price": 2400.00,
            "usd_amount": 500.00,
            "trade_date": "2024-01-16",
            "strategy": "Swing Trading",
            "trade_type": "Short",
            "stop_loss": 2600.00,
            "take_profit": 2300.00,
            "notes": "Expecting correction after pump"
        },
        {
            "pair": "SOL/USDT",
            "entry_price": 100.00,
            "exit_price": None,  # Open position
            "usd_amount": 300.00,
            "trade_date": "2024-01-17",
            "strategy": "HODLing",
            "trade_type": "Long",
            "stop_loss": 85.00,
            "take_profit": 150.00,
            "notes": "Long term Solana investment"
        }
    ]
    
    created_ids = []
    for trade in sample_crypto_trades:
        trade_id = tester.test_create_crypto_trade(trade)
        if trade_id:
            created_ids.append(trade_id)
    
    # Test 6: Get trades after creation
    print("\n📋 Testing trades list after creation...")
    success, trades_response = tester.test_get_trades()
    if success:
        print(f"   Found {trades_response.get('total', 0)} trades")
        # Verify USD amount and calculated quantity
        if 'trades' in trades_response:
            for trade in trades_response['trades']:
                expected_quantity = trade['usd_amount'] / trade['entry_price']
                actual_quantity = trade['quantity']
                print(f"   Trade {trade['pair']}: USD ${trade['usd_amount']} -> Quantity {actual_quantity:.8f} (Expected: {expected_quantity:.8f})")
    
    # Test 7: Test individual trade retrieval
    if created_ids:
        print("\n🔍 Testing individual trade retrieval...")
        tester.test_get_trade_by_id(created_ids[0])
    
    # Test 8: Test trade update (test quantity recalculation)
    if created_ids:
        print("\n✏️ Testing trade update with quantity recalculation...")
        update_data = {
            "exit_price": 48000.00,
            "usd_amount": 1200.00,  # Changed USD amount should recalculate quantity
            "notes": "Updated USD amount and exit price"
        }
        tester.test_update_trade(created_ids[0], update_data)
    
    # Test 9: Test filtering and search for crypto pairs
    print("\n🔍 Testing crypto-specific search and filters...")
    
    # Search by crypto pair
    tester.test_get_trades({"search": "BTC/USDT"})
    
    # Filter by trade type
    tester.test_get_trades({"trade_type": "Long"})
    
    # Filter by strategy
    tester.test_get_trades({"strategy": "DCA"})
    
    # Test pagination
    tester.test_get_trades({"page": "1", "limit": "2"})
    
    # Test sorting
    tester.test_get_trades({"sort_by": "pnl", "sort_order": "desc"})
    
    # Test 10: Get updated stats (should include ROI and Total Invested)
    print("\n📊 Testing updated crypto stats...")
    success, stats = tester.test_get_stats()
    if success:
        print(f"   Total Trades: {stats.get('total_trades', 0)}")
        print(f"   Total P&L: ${stats.get('total_pnl', 0)}")
        print(f"   Total Invested: ${stats.get('total_invested', 0)}")
        print(f"   Win Rate: {stats.get('win_rate', 0)}%")
        print(f"   ROI: {stats.get('roi', 0)}%")
    
    # Test 11: Test trade deletion
    if created_ids and len(created_ids) > 1:
        print("\n🗑️ Testing trade deletion...")
        tester.test_delete_trade(created_ids[-1])  # Delete last created trade
    
    # Test 12: Verify deletion worked
    if created_ids and len(created_ids) > 1:
        print("\n✅ Verifying deletion...")
        success, _ = tester.test_get_trade_by_id(created_ids[-1])
        if not success:
            print("✅ Trade deletion verified - trade not found as expected")
            tester.tests_passed += 1
        tester.tests_run += 1
    
    # Test 13: Test error cases
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
        "pair": "",  # Empty pair should fail
        "entry_price": "invalid",  # Invalid price
        "usd_amount": -100  # Negative amount
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