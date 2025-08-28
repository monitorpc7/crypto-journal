from fastapi import FastAPI, APIRouter, HTTPException, Query, File, UploadFile
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, date
import base64
from enum import Enum
import aiohttp
import asyncio


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Enums and Models
class TradeType(str, Enum):
    LONG = "Long"
    SHORT = "Short"

class CryptoTrade(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pair: str  # e.g., BTC/USDT, ETH/USDT
    entry_price: float
    exit_price: Optional[float] = None
    usd_amount: float  # Amount in USD invested
    quantity: float  # Calculated automatically
    trade_date: date
    pnl: Optional[float] = None
    strategy: str
    trade_type: TradeType
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    notes: Optional[str] = None
    image_data: Optional[str] = None  # base64 encoded image
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CryptoTradeCreate(BaseModel):
    pair: str
    entry_price: float
    exit_price: Optional[float] = None
    usd_amount: float
    trade_date: date
    pnl: Optional[float] = None
    strategy: str
    trade_type: TradeType
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    notes: Optional[str] = None
    image_data: Optional[str] = None

class CryptoTradeUpdate(BaseModel):
    pair: Optional[str] = None
    entry_price: Optional[float] = None
    exit_price: Optional[float] = None
    usd_amount: Optional[float] = None
    trade_date: Optional[date] = None
    pnl: Optional[float] = None
    strategy: Optional[str] = None
    trade_type: Optional[TradeType] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    notes: Optional[str] = None
    image_data: Optional[str] = None

class CryptoTradeResponse(BaseModel):
    trades: List[CryptoTrade]
    total: int
    page: int
    limit: int
    total_pages: int

class TickerData(BaseModel):
    symbol: str
    lastPrice: str
    priceChange: str
    priceChangePercent: str
    highPrice: str
    lowPrice: str
    volume: str

# MEXC API Integration
async def fetch_mexc_ticker(symbol: str = None):
    """Fetch 24h ticker data from MEXC API"""
    url = "https://api.mexc.com/api/v3/ticker/24hr"
    params = {}
    if symbol:
        params["symbol"] = symbol.replace("/", "")  # Convert BTC/USDT to BTCUSDT
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    return data
                else:
                    return None
    except Exception as e:
        print(f"Error fetching MEXC data: {e}")
        return None

# Helper function to calculate quantity
def calculate_quantity(usd_amount: float, entry_price: float) -> float:
    """Calculate crypto quantity based on USD amount and entry price"""
    return usd_amount / entry_price

# Helper function to calculate P&L
def calculate_pnl(trade_type: str, entry_price: float, exit_price: float, quantity: float) -> float:
    """Calculate P&L based on trade type"""
    if trade_type == TradeType.LONG:
        return (exit_price - entry_price) * quantity
    else:  # SHORT
        return (entry_price - exit_price) * quantity

# Crypto Trade Routes
@api_router.post("/trades", response_model=CryptoTrade)
async def create_trade(trade: CryptoTradeCreate):
    trade_dict = trade.dict()
    
    # Calculate quantity automatically
    quantity = calculate_quantity(trade.usd_amount, trade.entry_price)
    trade_dict["quantity"] = quantity
    
    trade_obj = CryptoTrade(**trade_dict)
    
    # Calculate P&L if exit_price is provided
    if trade_obj.exit_price and trade_obj.entry_price:
        trade_obj.pnl = calculate_pnl(trade_obj.trade_type, trade_obj.entry_price, trade_obj.exit_price, trade_obj.quantity)
    
    # Convert trade_obj to dict and handle date serialization
    trade_data = trade_obj.dict()
    if isinstance(trade_data['trade_date'], date):
        trade_data['trade_date'] = trade_data['trade_date'].isoformat()
    
    result = await db.crypto_trades.insert_one(trade_data)
    if result.inserted_id:
        return trade_obj
    raise HTTPException(status_code=500, detail="Failed to create trade")

@api_router.get("/trades", response_model=CryptoTradeResponse)
async def get_trades(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None),
    strategy: Optional[str] = Query(None),
    trade_type: Optional[TradeType] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    pnl_min: Optional[float] = Query(None),
    pnl_max: Optional[float] = Query(None),
    sort_by: Optional[str] = Query("created_at"),
    sort_order: Optional[str] = Query("desc")
):
    # Build filter query
    filter_query = {}
    
    if search:
        filter_query["pair"] = {"$regex": search, "$options": "i"}
    
    if strategy:
        filter_query["strategy"] = {"$regex": strategy, "$options": "i"}
    
    if trade_type:
        filter_query["trade_type"] = trade_type
    
    if date_from or date_to:
        date_filter = {}
        if date_from:
            date_filter["$gte"] = date_from
        if date_to:
            date_filter["$lte"] = date_to
        filter_query["trade_date"] = date_filter
    
    if pnl_min is not None or pnl_max is not None:
        pnl_filter = {}
        if pnl_min is not None:
            pnl_filter["$gte"] = pnl_min
        if pnl_max is not None:
            pnl_filter["$lte"] = pnl_max
        filter_query["pnl"] = pnl_filter
    
    # Build sort query
    sort_direction = -1 if sort_order == "desc" else 1
    sort_query = [(sort_by, sort_direction)]
    
    # Get total count
    total = await db.crypto_trades.count_documents(filter_query)
    
    # Get paginated results
    skip = (page - 1) * limit
    trades_cursor = db.crypto_trades.find(filter_query).sort(sort_query).skip(skip).limit(limit)
    trades_list = await trades_cursor.to_list(length=limit)
    
    trades = [CryptoTrade(**trade) for trade in trades_list]
    total_pages = (total + limit - 1) // limit
    
    return CryptoTradeResponse(
        trades=trades,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages
    )

@api_router.get("/trades/{trade_id}", response_model=CryptoTrade)
async def get_trade(trade_id: str):
    trade_doc = await db.crypto_trades.find_one({"id": trade_id})
    if not trade_doc:
        raise HTTPException(status_code=404, detail="Trade not found")
    return CryptoTrade(**trade_doc)

@api_router.put("/trades/{trade_id}", response_model=CryptoTrade)
async def update_trade(trade_id: str, trade_update: CryptoTradeUpdate):
    # Get existing trade
    existing_trade = await db.crypto_trades.find_one({"id": trade_id})
    if not existing_trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    # Prepare update data
    update_data = {k: v for k, v in trade_update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    # Handle date serialization
    if "trade_date" in update_data and isinstance(update_data["trade_date"], date):
        update_data["trade_date"] = update_data["trade_date"].isoformat()
    
    # Recalculate quantity if USD amount or entry price changed
    if "usd_amount" in update_data or "entry_price" in update_data:
        usd_amount = update_data.get("usd_amount", existing_trade["usd_amount"])
        entry_price = update_data.get("entry_price", existing_trade["entry_price"])
        update_data["quantity"] = calculate_quantity(usd_amount, entry_price)
    
    # Recalculate P&L if prices are updated
    if "exit_price" in update_data or "entry_price" in update_data or "usd_amount" in update_data:
        entry_price = update_data.get("entry_price", existing_trade["entry_price"])
        exit_price = update_data.get("exit_price", existing_trade.get("exit_price"))
        quantity = update_data.get("quantity", existing_trade["quantity"])
        trade_type = update_data.get("trade_type", existing_trade["trade_type"])
        
        if exit_price and entry_price:
            update_data["pnl"] = calculate_pnl(trade_type, entry_price, exit_price, quantity)
    
    # Update trade
    result = await db.crypto_trades.update_one(
        {"id": trade_id},
        {"$set": update_data}
    )
    
    if result.modified_count:
        updated_trade = await db.crypto_trades.find_one({"id": trade_id})
        return CryptoTrade(**updated_trade)
    
    raise HTTPException(status_code=500, detail="Failed to update trade")

@api_router.delete("/trades/{trade_id}")
async def delete_trade(trade_id: str):
    result = await db.crypto_trades.delete_one({"id": trade_id})
    if result.deleted_count:
        return {"message": "Trade deleted successfully"}
    raise HTTPException(status_code=404, detail="Trade not found")

@api_router.get("/trades/stats/summary")
async def get_trade_stats():
    pipeline = [
        {
            "$group": {
                "_id": None,
                "total_trades": {"$sum": 1},
                "total_pnl": {"$sum": "$pnl"},
                "total_invested": {"$sum": "$usd_amount"},
                "winning_trades": {
                    "$sum": {"$cond": [{"$gt": ["$pnl", 0]}, 1, 0]}
                },
                "losing_trades": {
                    "$sum": {"$cond": [{"$lt": ["$pnl", 0]}, 1, 0]}
                },
                "avg_pnl": {"$avg": "$pnl"}
            }
        }
    ]
    
    result = await db.crypto_trades.aggregate(pipeline).to_list(1)
    if result:
        stats = result[0]
        win_rate = (stats["winning_trades"] / stats["total_trades"] * 100) if stats["total_trades"] > 0 else 0
        roi = (stats["total_pnl"] / stats["total_invested"] * 100) if stats["total_invested"] > 0 else 0
        return {
            "total_trades": stats["total_trades"],
            "total_pnl": round(stats["total_pnl"] or 0, 2),
            "total_invested": round(stats["total_invested"] or 0, 2),
            "winning_trades": stats["winning_trades"],
            "losing_trades": stats["losing_trades"],
            "win_rate": round(win_rate, 2),
            "avg_pnl": round(stats["avg_pnl"] or 0, 2),
            "roi": round(roi, 2)
        }
    
    return {
        "total_trades": 0,
        "total_pnl": 0,
        "total_invested": 0,
        "winning_trades": 0,
        "losing_trades": 0,
        "win_rate": 0,
        "avg_pnl": 0,
        "roi": 0
    }

# MEXC API Routes
@api_router.get("/mexc/ticker")
async def get_mexc_ticker(symbols: str = Query(..., description="Comma-separated crypto pairs (e.g., BTC/USDT,ETH/USDT)")):
    """Get 24h ticker data for specified crypto pairs from MEXC"""
    pairs = [s.strip() for s in symbols.split(",")]
    tickers = []
    
    for pair in pairs:
        ticker_data = await fetch_mexc_ticker(pair)
        if ticker_data:
            # Handle both single ticker and list response
            if isinstance(ticker_data, list):
                for ticker in ticker_data:
                    if ticker.get("symbol") == pair.replace("/", ""):
                        tickers.append({
                            "symbol": pair,
                            "lastPrice": float(ticker.get("lastPrice", 0)),
                            "priceChange": float(ticker.get("priceChange", 0)),
                            "priceChangePercent": float(ticker.get("priceChangePercent", 0)),
                            "highPrice": float(ticker.get("highPrice", 0)),
                            "lowPrice": float(ticker.get("lowPrice", 0)),
                            "volume": float(ticker.get("volume", 0))
                        })
                        break
            else:
                tickers.append({
                    "symbol": pair,
                    "lastPrice": float(ticker_data.get("lastPrice", 0)),
                    "priceChange": float(ticker_data.get("priceChange", 0)),
                    "priceChangePercent": float(ticker_data.get("priceChangePercent", 0)),
                    "highPrice": float(ticker_data.get("highPrice", 0)),
                    "lowPrice": float(ticker_data.get("lowPrice", 0)),
                    "volume": float(ticker_data.get("volume", 0))
                })
    
    return {"tickers": tickers}

@api_router.get("/mexc/popular-pairs")
async def get_popular_pairs():
    """Get popular crypto pairs for the dashboard"""
    popular_pairs = ["BTC/USDT", "ETH/USDT", "BNB/USDT", "ADA/USDT", "SOL/USDT", "MATIC/USDT", "DOT/USDT", "AVAX/USDT"]
    symbols_param = ",".join(popular_pairs)
    
    result = await get_mexc_ticker(symbols_param)
    return result

# Legacy routes for testing
@api_router.get("/")
async def root():
    return {"message": "Crypto Trading Journal API"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()